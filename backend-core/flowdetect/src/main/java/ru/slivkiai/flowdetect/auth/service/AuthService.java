package ru.slivkiai.flowdetect.auth.service;

import java.time.LocalDateTime;
import java.util.Date;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ru.slivkiai.flowdetect.auth.dto.AuthResponse;
import ru.slivkiai.flowdetect.auth.dto.ForgotPasswordRequest;
import ru.slivkiai.flowdetect.auth.dto.LoginRequest;
import ru.slivkiai.flowdetect.auth.dto.OtpVerifyRequest;
import ru.slivkiai.flowdetect.auth.dto.RegisterRequest;
import ru.slivkiai.flowdetect.auth.dto.ResendOtpRequest;
import ru.slivkiai.flowdetect.auth.dto.ResetPasswordByTokenRequest;
import ru.slivkiai.flowdetect.auth.dto.ResetPasswordRequest;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.user.domain.entity.DeviceSession;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.repository.UserRepository;
import ru.slivkiai.flowdetect.user.service.DeviceSessionService;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;
import ru.slivkiai.flowdetect.user.service.UserService;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;

    private final JwtService jwtService;

    private final OtpService otpService;

    private final PasswordEncoder passwordEncoder;

    private final DeviceSessionService deviceSessionService;

    private final UserService userService;

    private final SecurityPolicyService securityPolicyService;

    public UserGetResponse register(RegisterRequest request) {

        if (userService.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Пользователь с таким email уже существует");
        }
        
        return userService.createUser(
                request.email(),
                request.password(),
                request.fullName()
        );
    }

    public AuthResponse login(LoginRequest request, String ip, String userAgent) {

        // Проверка email и существования пользователя
        if (request.email() == null || request.email().isBlank()) {
            throw new RuntimeException("Email cannot be empty");
        }

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new RuntimeException("Пользователь не найден!"));

        SecurityPolicy policy = securityPolicyService.getPolicy(user.getId());

        int maxAttempts = policy.getMaxFailedAttempts();
        int lockDuration = policy.getLockDurationSeconds();

        if (user.isAccountLocked() || user.isLocked()) {
            throw new RuntimeException("Аккаунт заблокирован");
        }

        // Проверка временной блокировки
        if (user.getLockUntil() != null && user.getLockUntil().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Аккаунт временно заблокирован до: " + user.getLockUntil());
        }

        log.info("Попытка входа пользователя: {}", user.getEmail());

        // Проверка пароля
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {

            int failed = user.getFailedAttempts() + 1;
            user.setFailedAttempts(failed);

            if (failed >= maxAttempts * 3) {
                user.setAccountLocked(true);
                log.warn("User permanently locked: {}", user.getEmail());
            }
            // Временный блок после 5 попыток
            else if (failed >= maxAttempts) {
                user.setLockUntil(LocalDateTime.now().plusSeconds(lockDuration));
                log.warn("User temporarily locked: {}", user.getEmail());
            }

            userRepository.save(user);
            throw new RuntimeException("Неверный логин или пароль");
        }

        // Успешный логин
        // Сбрасываем счётчик неудачных попыток при успешном входе
        if (user.getFailedAttempts() > 0) {
            user.setFailedAttempts(0);
            user.setLockUntil(null);
        }

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        // ================= ЛОГИКА 2FA =================

        // Email НЕ подтверждён → обычный логин
        if (!user.isEmailConfirmed()) {

            DeviceSession session = deviceSessionService.createOrUpdateSession(user, request.deviceId(), ip, userAgent);

            String access = jwtService.generateAccessToken(user, session.getSessionId());
            String refresh = jwtService.generateRefreshToken(user, session.getSessionId());

            return new AuthResponse(access, refresh, false, user.getEmail());
        }

        // Email подтверждён + 2FA включена → OTP
        if (user.isTwoFactorEnabled() && user.isEmailConfirmed()) {

            otpService.generateAndSendOtp(user.getEmail());

            log.info("OTP sent to {}", user.getEmail());

            return new AuthResponse(null, null, true, user.getEmail());
        }

        DeviceSession session = deviceSessionService.createOrUpdateSession(user, request.deviceId(), ip, userAgent);

        // Email подтверждён, но 2FA выключена → сразу токен
        String access = jwtService.generateAccessToken(user, session.getSessionId());
        String refresh = jwtService.generateRefreshToken(user, session.getSessionId());

        return new AuthResponse(access, refresh, false, user.getEmail());
    }

    public AuthResponse verifyAndGenerateToken(OtpVerifyRequest request, String ip, String userAgent) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean verified = otpService.verifyOtp(request.email(), request.otp());
        if (!verified)
            throw new RuntimeException("Invalid or expired OTP");

        log.info("OTP успешно подтверждён — выдаём токен для {}", user.getEmail());
        DeviceSession session = deviceSessionService.createOrUpdateSession(user, request.deviceId(), ip, userAgent);
        String access = jwtService.generateAccessToken(user, session.getSessionId());
        String refresh = jwtService.generateRefreshToken(user, session.getSessionId());

        return new AuthResponse(
                access,
                refresh,
                false,
                user.getEmail());
    }

    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Проверка OTP (ОБЯЗАТЕЛЬНО)
        boolean verified = otpService.verifyOtp(request.email(), request.otp());

        if (!verified) {
            throw new RuntimeException("OTP неверный или истёк");
        }

        // Новый != старый
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new RuntimeException("Новый пароль не должен совпадать со старым");
        }

        String newHash = passwordEncoder.encode(request.newPassword());

        user.setPassword(newHash);
        user.setLastPasswordChangeAt(LocalDateTime.now());
        user.setFailedAttempts(0);
        user.setAccountLocked(false);
        user.setLockUntil(null);
        userRepository.save(user);

        log.info("Пароль успешно обновлён для пользователя {}", user.getEmail());
    }

    public void validToken(String token) {
        try {
            var claims = jwtService.extractAllClaim(token);
            if (claims.getExpiration().before(new Date())) {
                throw new RuntimeException("Token expired");
            }
            log.info("Токен действителен для {}", claims.getSubject());
        } catch (Exception exception) {
            throw new RuntimeException("Invalid token", exception);
        }
    }

    // ---- Дополнительные методы для контроллера ----

    public void repeatOtpCode(ResendOtpRequest request) {
        otpService.generateAndSendOtp(request.email());
        log.info("Повтор OTP для {}", request.email());
    }

    public void forgotPassword(ForgotPasswordRequest request) {
        otpService.generateAndSendOtp(request.email());
        log.info("Отправлен OTP для восстановления пароля {}", request.email());
    }

    public void verifyOtpForgotPassword(OtpVerifyRequest request) {
        boolean verified = otpService.checkOtpWithoutRemoval(request.email(), request.otp());

        if (!verified)
            throw new RuntimeException("Invalid OTP for password reset");
        log.info("OTP успешно подтверждён для восстановления {}", request.email());
    }

    // === Смена пароля через токен === //
    public String verifyOtpForPasswordReset(OtpVerifyRequest request) {
        boolean verified = otpService.checkOtpWithoutRemoval(request.email(), request.otp());

        if (!verified) {
            throw new RuntimeException("Неверный или истёкший код подтверждения");
        }

        String resetToken = jwtService.generateResetToken(request.email());

        otpService.removeOtp(request.email());

        log.info("Выдача resetToken для {}", request.email());
        return resetToken;
    }

    public void resetPasswordByToken(ResetPasswordByTokenRequest request) {

        String email = jwtService.validateResetToken(request.resetToken());

        if (email == null) {
            throw new RuntimeException("Недействительный или истёкший токен");
        }

         User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("Пользователь не найден"));
        
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new RuntimeException("Новый пароль не должен совпадать со старым");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setLastPasswordChangeAt(LocalDateTime.now());
        user.setFailedAttempts(0);
        user.setAccountLocked(false);
        user.setLockUntil(null);
        userRepository.save(user);
        
        log.info("Пароль успешно обновлён для {}", user.getEmail());
    } 
}
