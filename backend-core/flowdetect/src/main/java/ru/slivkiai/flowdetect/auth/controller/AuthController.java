package ru.slivkiai.flowdetect.auth.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.bind.annotation.RequestBody;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ru.slivkiai.flowdetect.auth.dto.AuthResponse;
import ru.slivkiai.flowdetect.auth.dto.ForgotPasswordRequest;
import ru.slivkiai.flowdetect.auth.dto.LoginRequest;
import ru.slivkiai.flowdetect.auth.dto.OtpVerifyRequest;
import ru.slivkiai.flowdetect.auth.dto.RegisterRequest;
import ru.slivkiai.flowdetect.auth.dto.RegisterResponse;
import ru.slivkiai.flowdetect.auth.dto.ResendOtpRequest;
import ru.slivkiai.flowdetect.auth.dto.ResetPasswordRequest;
import ru.slivkiai.flowdetect.auth.service.AuthService;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    private static final int ACCESS_COOKIE_MAX_AGE = 15 * 60;
    private static final int REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@RequestBody @Valid RegisterRequest request) {
        
        try {
            UserGetResponse user = authService.register(request);
            
            return ResponseEntity.ok(new RegisterResponse(
                true,
                "Аккаунт создан. Пожалуйста, войдите в систему.",
                user.email()
            ));
            
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest()
                .body(new RegisterResponse(false, exception.getMessage(), null));
        } catch (Exception exception) {
            return ResponseEntity.internalServerError()
                .body(new RegisterResponse(false, "Ошибка сервера", null));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> authenticate(@RequestBody LoginRequest request,
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {

        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip == null)
            ip = httpRequest.getRemoteAddr();

        String userAgent = httpRequest.getHeader("User-Agent");

        AuthResponse result = authService.login(request, ip, userAgent);

        if (result.accessToken() != null) {
            addHttpOnlyCookie(httpResponse, "access_token", result.accessToken(), ACCESS_COOKIE_MAX_AGE,
                    httpRequest.isSecure()); // 15 мин
        }
        if (result.refreshToken() != null) {
            addHttpOnlyCookie(httpResponse, "refresh_token", result.refreshToken(), REFRESH_COOKIE_MAX_AGE,
                    httpRequest.isSecure()); // 7 дней
        }

        return ResponseEntity.ok(new AuthResponse(
                null,
                null,
                result.requireOtp(),
                result.email()));
    }

    @PostMapping("/token")
    public ResponseEntity<AuthResponse> getToken(@RequestBody OtpVerifyRequest request,
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {

        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip == null)
            ip = httpRequest.getRemoteAddr();

        String userAgent = httpRequest.getHeader("User-Agent");

        AuthResponse response = authService.verifyAndGenerateToken(request, ip, userAgent);

        if (response.accessToken() != null) {
            addHttpOnlyCookie(httpResponse, "access_token", response.accessToken(),
                    ACCESS_COOKIE_MAX_AGE, httpRequest.isSecure());
        }
        if (response.refreshToken() != null) {
            addHttpOnlyCookie(httpResponse, "refresh_token", response.refreshToken(),
                    REFRESH_COOKIE_MAX_AGE, httpRequest.isSecure());
        }

        return ResponseEntity.ok(new AuthResponse(
                null, null, false, response.email()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        clearCookie(response, "access_token");
        clearCookie(response, "refresh_token");
        return ResponseEntity.ok().build();
    }

    private void addHttpOnlyCookie(HttpServletResponse response, String name, String value,
            int maxAge, boolean isSecure) {
        boolean secure = isSecure; // в продакшене будет true автоматически

        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        log.debug("Set cookie: {} (maxAge={}s, secure={})", name, maxAge, secure);
    }

    private void clearCookie(HttpServletResponse response, String name) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        log.debug("Cleared cookie: {}", name);
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<String> repeatOtp(@RequestBody ResendOtpRequest request) {
        authService.repeatOtpCode(request);
        return ResponseEntity.ok("OTP repeat");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok("OTP sent to email");
    }

    @PostMapping("/verify-otp-forgot-password")
    public ResponseEntity<String> verifyOtpForgotPassword(@RequestBody OtpVerifyRequest request) {
        authService.verifyOtpForgotPassword(request);
        return ResponseEntity.ok("OTP verify success!");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok("Password has been reset successfully");
    }

    @GetMapping("/valid-token")
    public ResponseEntity<String> validToken(@RequestParam("token") String token) {
        authService.validToken(token);
        return ResponseEntity.ok("Token is valid");
    }
}
