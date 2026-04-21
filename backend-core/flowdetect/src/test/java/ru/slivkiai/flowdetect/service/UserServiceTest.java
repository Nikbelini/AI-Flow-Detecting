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

import ru.slivkiai.flowdetect.auth.service.OtpService;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.ChangePassword;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.dto.UserUpdate;
import ru.slivkiai.flowdetect.user.exception.UserNotFoundException;
import ru.slivkiai.flowdetect.user.mapper.UserMapper;
import ru.slivkiai.flowdetect.user.repository.UserRepository;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;
import ru.slivkiai.flowdetect.user.service.UserService;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder encoder;

    @Mock
    private SecurityPolicyService securityPolicyService;

    @Mock
    private OtpService otpService;

    @InjectMocks
    private UserService userService;

    private User user;
    private UserGetResponse userDto;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("test@example.com")
                .password("encoded")
                .fullName("Test User")
                .role(Role.USER)
                .accountLocked(false)
                .emailConfirmed(false)
                .twoFactorEnabled(false)
                .failedAttempts(0)
                .build();

        userDto = new UserGetResponse(1L, "test@example.com", "Test User",
                Role.USER, false, false, null, null);
    }

    @Test
    @DisplayName("createUser — успешное создание пользователя")
    void createUser_success() {
        given(userRepository.existsByEmail("test@example.com")).willReturn(false);
        given(encoder.encode("rawPass")).willReturn("encoded");
        given(userRepository.save(any(User.class))).willReturn(user);
        given(userMapper.toDto(user)).willReturn(userDto);

        UserGetResponse result = userService.createUser("test@example.com", "rawPass", "Test User");

        assertThat(result).isNotNull();
        assertThat(result.email()).isEqualTo("test@example.com");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();

        assertThat(saved.getPassword()).isEqualTo("encoded");
        assertThat(saved.getRole()).isEqualTo(Role.USER);
        assertThat(saved.isAccountLocked()).isFalse();
        assertThat(saved.isEmailConfirmed()).isFalse();
        verify(securityPolicyService).createDefaultPolicy(user);
    }

    @Test
    @DisplayName("createUser — email уже существует → IllegalArgumentException")
    void createUser_emailExists() {
        given(userRepository.existsByEmail("test@example.com")).willReturn(true);

        assertThatThrownBy(() -> userService.createUser("test@example.com", "pass", "Name"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("getMe — возвращает DTO существующего пользователя")
    void getMe_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(userMapper.toDto(user)).willReturn(userDto);

        UserGetResponse result = userService.getMe(1L);

        assertThat(result.email()).isEqualTo("test@example.com");
    }

    @Test
    @DisplayName("getMe — пользователь не найден → UserNotFoundException")
    void getMe_notFound() {
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getMe(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    @DisplayName("updateMe — обновление имени")
    void updateMe_fullNameUpdated() {
        UserUpdate dto = new UserUpdate("New Name", null);

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(userRepository.save(any(User.class))).willReturn(user);
        given(userMapper.toDto(user)).willReturn(userDto);

        userService.updateMe(1L, dto);

        assertThat(user.getFullName()).isEqualTo("New Name");
    }

    @Test
    @DisplayName("updateMe — смена email: emailConfirmed и 2FA сбрасываются")
    void updateMe_emailChanged_resets2fa() {
        user.setEmailConfirmed(true);
        user.setTwoFactorEnabled(true);
        UserUpdate dto = new UserUpdate(null, "new@example.com");

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(userRepository.existsByEmail("new@example.com")).willReturn(false);
        given(userRepository.save(any())).willReturn(user);
        given(userMapper.toDto(user)).willReturn(userDto);

        userService.updateMe(1L, dto);

        assertThat(user.isEmailConfirmed()).isFalse();
        assertThat(user.isTwoFactorEnabled()).isFalse();
        assertThat(user.getEmail()).isEqualTo("new@example.com");
    }

    @Test
    @DisplayName("updateMe — новый email уже занят → IllegalArgumentException")
    void updateMe_emailAlreadyTaken() {
        UserUpdate dto = new UserUpdate(null, "taken@example.com");

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(userRepository.existsByEmail("taken@example.com")).willReturn(true);

        assertThatThrownBy(() -> userService.updateMe(1L, dto))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("updateMe — аккаунт заблокирован → IllegalStateException")
    void updateMe_accountLocked() {
        user.setAccountLocked(true);
        UserUpdate dto = new UserUpdate("New Name", null);

        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.updateMe(1L, dto))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("locked");
    }

    @Test
    @DisplayName("confirmEmailAndEnable2fa — верный OTP подтверждает email и включает 2FA")
    void confirmEmail_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(otpService.verifyOtp("test@example.com", "123456")).willReturn(true);

        userService.confirmEmailAndEnable2fa(1L, "123456");

        assertThat(user.isEmailConfirmed()).isTrue();
        assertThat(user.isTwoFactorEnabled()).isTrue();
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("confirmEmailAndEnable2fa — неверный OTP → IllegalArgumentException")
    void confirmEmail_invalidOtp() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(otpService.verifyOtp("test@example.com", "000000")).willReturn(false);

        assertThatThrownBy(() -> userService.confirmEmailAndEnable2fa(1L, "000000"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(user.isEmailConfirmed()).isFalse();
    }

    @Test
    @DisplayName("confirmEmailAndEnable2fa — email уже подтверждён → IllegalStateException")
    void confirmEmail_alreadyConfirmed() {
        user.setEmailConfirmed(true);
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.confirmEmailAndEnable2fa(1L, "123456"))
                .isInstanceOf(IllegalStateException.class);

        verify(otpService, never()).verifyOtp(any(), any());
    }

    @Test
    @DisplayName("disableTwoFactorOnly — верный OTP отключает 2FA (email остаётся подтверждённым)")
    void disable2fa_success() {
        user.setEmailConfirmed(true);
        user.setTwoFactorEnabled(true);

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(otpService.verifyOtp("test@example.com", "654321")).willReturn(true);

        userService.disableTwoFactorOnly(1L, "654321");

        assertThat(user.isTwoFactorEnabled()).isFalse();
        assertThat(user.isEmailConfirmed()).isTrue();
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("disableTwoFactorOnly — 2FA уже выключена → IllegalStateException")
    void disable2fa_alreadyDisabled() {
        user.setTwoFactorEnabled(false);
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.disableTwoFactorOnly(1L, "any"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("changePassword — успешная смена пароля")
    void changePassword_success() {
        ChangePassword dto = new ChangePassword("oldPass", "newPass", "newPass");

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(encoder.matches("oldPass", "encoded")).willReturn(true);
        given(encoder.encode("newPass")).willReturn("new_encoded");

        userService.changePassword(1L, dto);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPassword()).isEqualTo("new_encoded");
    }

    @Test
    @DisplayName("changePassword — неверный старый пароль → IllegalArgumentException")
    void changePassword_wrongOldPassword() {
        ChangePassword dto = new ChangePassword("wrong", "newPass", "newPass");

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(encoder.matches("wrong", "encoded")).willReturn(false);

        assertThatThrownBy(() -> userService.changePassword(1L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Wrong password");
    }

    @Test
    @DisplayName("changePassword — пароли не совпадают → IllegalArgumentException")
    void changePassword_passwordsMismatch() {
        ChangePassword dto = new ChangePassword("oldPass", "newPass", "different");

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(encoder.matches("oldPass", "encoded")).willReturn(true);

        assertThatThrownBy(() -> userService.changePassword(1L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("match");
    }

    @Test
    @DisplayName("deleteMe — удаляет существующего пользователя")
    void deleteMe_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        userService.deleteMe(1L);

        verify(userRepository).delete(user);
    }

    @Test
    @DisplayName("deleteMe — пользователь не найден → UserNotFoundException")
    void deleteMe_notFound() {
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> userService.deleteMe(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    @DisplayName("requestConfirmationOtp — отправляет OTP для неподтверждённого email")
    void requestConfirmationOtp_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        userService.requestConfirmationOtp(1L);

        verify(otpService).generateAndSendOtp("test@example.com");
    }

    @Test
    @DisplayName("requestConfirmationOtp — email уже подтверждён → IllegalStateException")
    void requestConfirmationOtp_alreadyConfirmed() {
        user.setEmailConfirmed(true);
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.requestConfirmationOtp(1L))
                .isInstanceOf(IllegalStateException.class);

        verify(otpService, never()).generateAndSendOtp(any());
    }
}