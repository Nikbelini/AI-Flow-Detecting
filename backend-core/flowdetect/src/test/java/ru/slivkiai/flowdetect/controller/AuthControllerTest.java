package ru.slivkiai.flowdetect.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import ru.slivkiai.flowdetect.auth.controller.AuthController;
import ru.slivkiai.flowdetect.auth.dto.*;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.auth.service.AuthService;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(AuthControllerTest.TestExceptionHandler.class) 
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @Autowired
        private ObjectMapper objectMapper;

        @MockBean
        private AuthService authService;

        @MockBean
        private JwtService jwtService;

        @MockBean
        private UserDetailsService userDetailsService;

        @Nested
        @DisplayName("POST /api/auth/register")
        class RegisterTests {

                @Test
                @DisplayName("успешная регистрация — 200, success=true, email в теле")
                void register_success() throws Exception {
                        RegisterRequest request = new RegisterRequest("test@example.com", "password123", "Test User");

                        UserGetResponse userResponse = new UserGetResponse(
                                        1L, "test@example.com", "Test User", Role.USER, false, false, null, null);

                        given(authService.register(any(RegisterRequest.class))).willReturn(userResponse);

                        mockMvc.perform(post("/api/auth/register")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.success").value(true))
                                        .andExpect(jsonPath("$.email").value("test@example.com"));

                        verify(authService).register(any(RegisterRequest.class));
                }

                @Test
                @DisplayName("email уже существует — 400, success=false, сообщение об ошибке")
                void register_emailAlreadyExists() throws Exception {
                        RegisterRequest request = new RegisterRequest("test@example.com", "password123", "Test User");

                        given(authService.register(any(RegisterRequest.class)))
                                        .willThrow(new IllegalArgumentException("Email уже существует"));

                        mockMvc.perform(post("/api/auth/register")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.success").value(false))
                                        .andExpect(jsonPath("$.message").value("Email уже существует"));
                }

                @Test
                @DisplayName("невалидный email — 400 (Bean Validation)")
                void register_invalidEmail() throws Exception {
                        String body = """
                                        {"email":"not-an-email","password":"password123","fullName":"Test"}
                                        """;

                        mockMvc.perform(post("/api/auth/register")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                                        .andExpect(status().isBadRequest());
                }

                @Test
                @DisplayName("пустой пароль — 400 (Bean Validation)")
                void register_blankPassword() throws Exception {
                        String body = """
                                        {"email":"test@example.com","password":"","fullName":"Test"}
                                        """;

                        mockMvc.perform(post("/api/auth/register")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                                        .andExpect(status().isBadRequest());
                }
        }

        @Nested
        @DisplayName("POST /api/auth/login")
        class LoginTests {

                @Test
                @DisplayName("успешный вход — куки установлены, requireOtp=false, токены не в теле")
                void login_success() throws Exception {
                        LoginRequest request = new LoginRequest("test@example.com", "password123", null);

                        AuthResponse serviceResponse = new AuthResponse(
                                        "access_token_mock", "refresh_token_mock", false, "test@example.com");

                        // anyString() не матчит null — используем any() для ip/userAgent
                        given(authService.login(any(LoginRequest.class), any(), any()))
                                        .willReturn(serviceResponse);

                        mockMvc.perform(post("/api/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request))
                                        .header("X-Forwarded-For", "192.168.1.1")
                                        .header("User-Agent", "TestAgent"))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.requireOtp").value(false))
                                        .andExpect(jsonPath("$.email").value("test@example.com"))
                                        .andExpect(jsonPath("$.accessToken").doesNotExist()) // null не сериализуется
                                        .andExpect(cookie().exists("access_token"))
                                        .andExpect(cookie().httpOnly("access_token", true))
                                        .andExpect(cookie().exists("refresh_token"))
                                        .andExpect(cookie().httpOnly("refresh_token", true));
                }

                @Test
                @DisplayName("2FA требуется — requireOtp=true, cookie НЕ устанавливаются")
                void login_requiresOtp() throws Exception {
                        LoginRequest request = new LoginRequest("test@example.com", "password123", null);

                        AuthResponse otpResponse = new AuthResponse(null, null, true, "test@example.com");

                        given(authService.login(any(LoginRequest.class), any(), any()))
                                        .willReturn(otpResponse);

                        mockMvc.perform(post("/api/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.requireOtp").value(true))
                                        .andExpect(cookie().doesNotExist("access_token"))
                                        .andExpect(cookie().doesNotExist("refresh_token"));
                }

                @Test
                @DisplayName("сервис бросает RuntimeException → 500")
                @WithMockUser
                void login_serviceThrows() throws Exception {
                        LoginRequest request = new LoginRequest("test@example.com", "wrong", null);

                        given(authService.login(any(LoginRequest.class), any(), any()))
                                        .willThrow(new RuntimeException("Неверный логин или пароль"));

                        mockMvc.perform(post("/api/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andExpect(status().isInternalServerError());
                }
        }

        @Nested
        @DisplayName("POST /api/auth/logout")
        class LogoutTests {

                @Test
                @DisplayName("успешный выход — куки обнуляются (maxAge=0)")
                void logout_success() throws Exception {
                        mockMvc.perform(post("/api/auth/logout"))
                                        .andExpect(status().isOk())
                                        .andExpect(cookie().maxAge("access_token", 0))
                                        .andExpect(cookie().maxAge("refresh_token", 0));
                }
        }

        @Nested
        @DisplayName("POST /api/auth/forgot-password")
        class ForgotPasswordTests {

                @Test
                @DisplayName("запрос OTP для сброса пароля — 200")
                void forgotPassword_success() throws Exception {
                        ForgotPasswordRequest request = new ForgotPasswordRequest("test@example.com");

                        mockMvc.perform(post("/api/auth/forgot-password")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andExpect(status().isOk())
                                        .andExpect(content().string("OTP sent to email"));

                        verify(authService).forgotPassword(any(ForgotPasswordRequest.class));
                }
        }

        @Nested
        @DisplayName("POST /api/auth/reset-password/by-token")
        class ResetPasswordByTokenTests {

                @Test
                @DisplayName("успешный сброс пароля по токену — 200, redirect в теле")
                void resetPasswordByToken_success() throws Exception {
                        ResetPasswordByTokenRequest request = new ResetPasswordByTokenRequest(
                                        "reset_token_123", "newSecurePass123!");

                        mockMvc.perform(post("/api/auth/reset-password/by-token")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.message").value("Пароль успешно изменён"))
                                        .andExpect(jsonPath("$.redirect").value("/login"));

                        verify(authService).resetPasswordByToken(any(ResetPasswordByTokenRequest.class));
                }
        }

        @Nested
        @DisplayName("POST /api/auth/resend-otp")
        class ResendOtpTests {

                @Test
                @DisplayName("повторная отправка OTP — 200")
                void resendOtp_success() throws Exception {
                        String body = """
                                        {"email":"test@example.com"}
                                        """;

                        mockMvc.perform(post("/api/auth/resend-otp")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                                        .andExpect(status().isOk())
                                        .andExpect(content().string("OTP repeat"));
                }
        }

        @ControllerAdvice
        static class TestExceptionHandler {
        @ExceptionHandler(RuntimeException.class)
        public ResponseEntity<Void> handleRuntimeException(RuntimeException e) {
            return ResponseEntity.status(500).build();
        }
    }
}