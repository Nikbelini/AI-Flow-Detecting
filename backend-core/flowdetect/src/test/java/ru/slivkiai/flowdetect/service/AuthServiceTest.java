package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import ru.slivkiai.flowdetect.auth.dto.AuthResponse;
import ru.slivkiai.flowdetect.auth.dto.LoginRequest;
import ru.slivkiai.flowdetect.auth.dto.OtpVerifyRequest;
import ru.slivkiai.flowdetect.auth.dto.RegisterRequest;
import ru.slivkiai.flowdetect.auth.dto.ResetPasswordRequest;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.auth.service.AuthService;
import ru.slivkiai.flowdetect.auth.service.OtpService;
import ru.slivkiai.flowdetect.user.domain.entity.DeviceSession;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.repository.UserRepository;
import ru.slivkiai.flowdetect.user.service.DeviceSessionService;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;
import ru.slivkiai.flowdetect.user.service.UserService;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtService jwtService;

    @Mock
    private OtpService otpService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private DeviceSessionService deviceSessionService;

    @Mock
    private UserService userService;

    @Mock
    private SecurityPolicyService securityPolicyService;

    @InjectMocks
    private AuthService authService;

    private User enabledUser;

    private SecurityPolicy defaultPolicy;

    private DeviceSession fakeSession;

    @BeforeEach
    void setUp() {
        enabledUser = User.builder()
                .id(1L)
                .email("test@example.com")
                .password("encoded_password")
                .fullName("Test User")
                .role(Role.USER)
                .accountLocked(false)
                .emailConfirmed(false)
                .twoFactorEnabled(false)
                .failedAttempts(0)
                .build();

        defaultPolicy = SecurityPolicy.builder()
                .maxFailedAttempts(5)
                .lockDurationSeconds(60)
                .passwordExpirationDays(30)
                .build();

        fakeSession = DeviceSession.builder()
                .id(1L)
                .sessionId("device-id-abc")
                .user(enabledUser)
                .build();
    }

    @Test
    @DisplayName("register — успешная регистрация нового пользователя")
    void register_success() {
        RegisterRequest request = new RegisterRequest("new@example.com", "password123", "New User");
        UserGetResponse expected = new UserGetResponse(
                2L, "new@example.com", "New User", Role.USER, false, false, null, null);

        given(userService.existsByEmail("new@example.com")).willReturn(false);
        given(userService.createUser("new@example.com", "password123", "New User")).willReturn(expected);

        UserGetResponse result = authService.register(request);

        assertThat(result).isNotNull();
        assertThat(result.email()).isEqualTo("new@example.com");
        assertThat(result.fullName()).isEqualTo("New User");
        verify(userService).createUser("new@example.com", "password123", "New User");
    }

    @Test
    @DisplayName("register — email уже занят → IllegalArgumentException")
    void register_emailAlreadyExists() {
        RegisterRequest request = new RegisterRequest("test@example.com", "pass", "Name");
        given(userService.existsByEmail("test@example.com")).willReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("email");

        verify(userService, never()).createUser(any(), any(), any());
    }

    @Test
    @DisplayName("login — успешный вход без 2FA: возвращает токены, requireOtp=false")
    void login_success_no2fa() {
        LoginRequest request = new LoginRequest("test@example.com", "password123", "device-id-abc");

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(securityPolicyService.getPolicy(1L)).willReturn(defaultPolicy);
        given(passwordEncoder.matches("password123", "encoded_password")).willReturn(true);
        given(deviceSessionService.createOrUpdateSession(eq(enabledUser), eq("device-id-abc"), any(), any()))
                .willReturn(fakeSession);
        given(jwtService.generateAccessToken(enabledUser, "device-id-abc")).willReturn("access_token");
        given(jwtService.generateRefreshToken(enabledUser, "device-id-abc")).willReturn("refresh_token");

        AuthResponse result = authService.login(request, "192.168.1.1", "TestAgent");

        assertThat(result.accessToken()).isEqualTo("access_token");
        assertThat(result.refreshToken()).isEqualTo("refresh_token");
        assertThat(result.requireOtp()).isFalse();
        assertThat(result.email()).isEqualTo("test@example.com");
    }

    @Test
    @DisplayName("login — 2FA включена → токены не выдаются, requireOtp=true, OTP отправляется")
    void login_requires2fa() {
        enabledUser = User.builder()
                .id(1L).email("test@example.com").password("encoded_password")
                .role(Role.USER).accountLocked(false)
                .emailConfirmed(true).twoFactorEnabled(true)
                .failedAttempts(0).build();

        LoginRequest request = new LoginRequest("test@example.com", "password123", null);

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(securityPolicyService.getPolicy(1L)).willReturn(defaultPolicy);
        given(passwordEncoder.matches("password123", "encoded_password")).willReturn(true);

        AuthResponse result = authService.login(request, "127.0.0.1", "Agent");

        assertThat(result.requireOtp()).isTrue();
        assertThat(result.accessToken()).isNull();
        assertThat(result.refreshToken()).isNull();
        verify(otpService).generateAndSendOtp("test@example.com");
    }

    @Test
    @DisplayName("login — неверный пароль → RuntimeException, счётчик неудачных попыток инкрементируется")
    void login_invalidPassword_incrementsFailedAttempts() {
        LoginRequest request = new LoginRequest("test@example.com", "wrong", null);

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(securityPolicyService.getPolicy(1L)).willReturn(defaultPolicy);
        given(passwordEncoder.matches("wrong", "encoded_password")).willReturn(false);

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1", "Agent"))
                .isInstanceOf(RuntimeException.class);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getFailedAttempts()).isEqualTo(1);
    }

    @Test
    @DisplayName("login — пользователь навсегда заблокирован → RuntimeException без проверки пароля")
    void login_accountLocked() {
        enabledUser.setAccountLocked(true);
        LoginRequest request = new LoginRequest("test@example.com", "password123", null);

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(securityPolicyService.getPolicy(1L)).willReturn(defaultPolicy);

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1", "Agent"))
                .isInstanceOf(RuntimeException.class);

        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    @DisplayName("login — временная блокировка ещё действует → RuntimeException")
    void login_temporarilyLocked() {
        enabledUser.setLockUntil(LocalDateTime.now().plusMinutes(5));
        LoginRequest request = new LoginRequest("test@example.com", "password123", null);

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(securityPolicyService.getPolicy(1L)).willReturn(defaultPolicy);

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1", "Agent"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Аккаунт заблокирован");
    }

    @Test
    @DisplayName("login — успешный вход сбрасывает счётчик failedAttempts")
    void login_successResetsFailedAttempts() {
        enabledUser.setFailedAttempts(3);
        LoginRequest request = new LoginRequest("test@example.com", "password123", "device-id-abc");

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(securityPolicyService.getPolicy(1L)).willReturn(defaultPolicy);
        given(passwordEncoder.matches("password123", "encoded_password")).willReturn(true);
        given(deviceSessionService.createOrUpdateSession(any(), any(), any(), any())).willReturn(fakeSession);
        given(jwtService.generateAccessToken(any(User.class), any())).willReturn("access");
        given(jwtService.generateRefreshToken(any(User.class), any())).willReturn("refresh");

        authService.login(request, "127.0.0.1", "Agent");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, atLeastOnce()).save(captor.capture());
        User saved = captor.getAllValues().get(0);
        assertThat(saved.getFailedAttempts()).isEqualTo(0);
    }

    @Test
    @DisplayName("login — пользователь не найден → RuntimeException")
    void login_userNotFound() {
        LoginRequest request = new LoginRequest("noone@example.com", "pass", null);

        given(userRepository.findByEmail("noone@example.com")).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request, "127.0.0.1", "Agent"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("verifyAndGenerateToken — верный OTP выдаёт токены")
    void verifyOtp_success() {
        OtpVerifyRequest request = new OtpVerifyRequest("test@example.com", "123456", "device-id-abc", null);

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(otpService.verifyOtp("test@example.com", "123456")).willReturn(true);
        given(deviceSessionService.createOrUpdateSession(any(), any(), any(), any())).willReturn(fakeSession);
        given(jwtService.generateAccessToken(any(User.class), any())).willReturn("access");
        given(jwtService.generateRefreshToken(any(User.class), any())).willReturn("refresh");

        AuthResponse result = authService.verifyAndGenerateToken(request, "127.0.0.1", "Agent");

        assertThat(result.accessToken()).isEqualTo("access");
        assertThat(result.requireOtp()).isFalse();
    }

    @Test
    @DisplayName("verifyAndGenerateToken — неверный OTP → RuntimeException")
    void verifyOtp_invalid() {
        OtpVerifyRequest request = new OtpVerifyRequest("test@example.com", "000000", null, null);

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(otpService.verifyOtp("test@example.com", "000000")).willReturn(false);

        assertThatThrownBy(() -> authService.verifyAndGenerateToken(request, "127.0.0.1", "Agent"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("OTP");
    }

    @Test
    @DisplayName("resetPassword — успешный сброс пароля через OTP")
    void resetPassword_success() {
        ResetPasswordRequest request = new ResetPasswordRequest("test@example.com", "newPassword1", "123456");

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(otpService.verifyOtp("test@example.com", "123456")).willReturn(true);
        given(passwordEncoder.matches("newPassword1", "encoded_password")).willReturn(false);
        given(passwordEncoder.encode("newPassword1")).willReturn("new_encoded");

        authService.resetPassword(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPassword()).isEqualTo("new_encoded");
        assertThat(captor.getValue().getFailedAttempts()).isEqualTo(0);
        assertThat(captor.getValue().isAccountLocked()).isFalse();
    }

    @Test
    @DisplayName("resetPassword — новый пароль совпадает со старым → RuntimeException")
    void resetPassword_sameAsOld() {
        // "samePassword" — это и OTP, и новый пароль должны совпадать с тем, что в request
        ResetPasswordRequest request = new ResetPasswordRequest("test@example.com", "samePassword", "123456");

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(otpService.verifyOtp("test@example.com", "123456")).willReturn(true);
        given(passwordEncoder.matches("samePassword", "encoded_password")).willReturn(true);

        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("совпадать");

        verify(passwordEncoder, never()).encode(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("resetPassword — неверный OTP → RuntimeException, пароль не меняется")
    void resetPassword_invalidOtp() {
        ResetPasswordRequest request = new ResetPasswordRequest("test@example.com", "000000", "newPass");

        given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(enabledUser));
        given(otpService.verifyOtp("test@example.com", "000000")).willReturn(false);

        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(RuntimeException.class);

        verify(passwordEncoder, never()).encode(any());
        verify(userRepository, never()).save(any());
    }
}