package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.UserCreateRequest;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.exception.UserNotFoundException;
import ru.slivkiai.flowdetect.user.mapper.UserMapper;
import ru.slivkiai.flowdetect.user.repository.UserRepository;
import ru.slivkiai.flowdetect.user.service.AdminUserService;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserMapper userMapper;
    @Mock
    private PasswordEncoder encoder;

    @InjectMocks
    private AdminUserService adminUserService;

    private User user;
    private UserGetResponse userDto;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("user@example.com")
                .password("encoded")
                .fullName("John Doe")
                .role(Role.USER)
                .accountLocked(false)
                .failedAttempts(0)
                .build();

        userDto = new UserGetResponse(
                1L, "user@example.com", "John Doe", Role.USER, false, false, null, null);
    }

    // ── createUser ────────────────────────────────────────────────────────

    @Test
    @DisplayName("createUser — успешное создание: пароль кодируется, роль USER, accountLocked=false")
    void createUser_success() {
        // UserCreateRequest record: (String email, String password, String fullName)
        UserCreateRequest request = new UserCreateRequest("new@example.com", "rawPass", "Jane Doe");

        given(userMapper.toEntity(request)).willReturn(User.builder().build());
        given(encoder.encode("rawPass")).willReturn("encoded_pass");
        given(userRepository.save(any(User.class))).willReturn(user);
        given(userMapper.toDto(user)).willReturn(userDto);

        UserGetResponse result = adminUserService.createUser(request);

        assertThat(result).isNotNull();
        assertThat(result.email()).isEqualTo("user@example.com");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());

        User saved = captor.getValue();
        assertThat(saved.getPassword()).isEqualTo("encoded_pass");
        assertThat(saved.getRole()).isEqualTo(Role.USER);
        assertThat(saved.isAccountLocked()).isFalse();
        assertThat(saved.isEmailConfirmed()).isFalse();
    }

    // ── getAllUsers ────────────────────────────────────────────────────────

    @Test
    @DisplayName("getAllUsers — без поиска: вызывается findAll с пагинацией")
    void getAllUsers_noSearch() {
        PageRequest pageable = PageRequest.of(0, 10);
        Page<User> page = new PageImpl<>(List.of(user), pageable, 1);

        given(userRepository.findAll(pageable)).willReturn(page);
        given(userMapper.toDto(user)).willReturn(userDto);

        Page<UserGetResponse> result = adminUserService.getAllUsers(Role.USER, null, pageable);

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().get(0).email()).isEqualTo("user@example.com");
        verify(userRepository).findAll(pageable);
        verify(userRepository, never())
                .findByRoleAndFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(any(), any(), any(), any());
    }

    @Test
    @DisplayName("getAllUsers — пустая строка поиска: вызывается findAll")
    void getAllUsers_blankSearch() {
        PageRequest pageable = PageRequest.of(0, 10);
        Page<User> page = new PageImpl<>(List.of(user), pageable, 1);

        given(userRepository.findAll(pageable)).willReturn(page);
        given(userMapper.toDto(user)).willReturn(userDto);

        adminUserService.getAllUsers(Role.USER, "   ", pageable);

        verify(userRepository).findAll(pageable);
    }

    @Test
    @DisplayName("getAllUsers — с поиском: вызывается findByRoleAndFullNameContaining...")
    void getAllUsers_withSearch() {
        PageRequest pageable = PageRequest.of(0, 10);
        Page<User> page = new PageImpl<>(List.of(user), pageable, 1);

        given(userRepository.findByRoleAndFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(
                Role.USER, "john", "john", pageable)).willReturn(page);
        given(userMapper.toDto(user)).willReturn(userDto);

        Page<UserGetResponse> result = adminUserService.getAllUsers(Role.USER, "john", pageable);

        assertThat(result.getContent()).hasSize(1);
        verify(userRepository).findByRoleAndFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(
                Role.USER, "john", "john", pageable);
        verify(userRepository, never()).findAll(any(PageRequest.class));
    }

    // ── getUser ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("getUser — возвращает DTO существующего пользователя")
    void getUser_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(userMapper.toDto(user)).willReturn(userDto);

        UserGetResponse result = adminUserService.getUser(1L);

        assertThat(result.id()).isEqualTo(1L);
        assertThat(result.email()).isEqualTo("user@example.com");
    }

    @Test
    @DisplayName("getUser — пользователь не найден → UserNotFoundException")
    void getUser_notFound() {
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.getUser(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    // ── lockUser ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("lockUser — устанавливает accountLocked=true и сохраняет")
    void lockUser_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        adminUserService.lockUser(1L);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().isAccountLocked()).isTrue();
    }

    @Test
    @DisplayName("lockUser — пользователь не найден → UserNotFoundException")
    void lockUser_notFound() {
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.lockUser(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    // ── unlockUser ────────────────────────────────────────────────────────

    @Test
    @DisplayName("unlockUser — сбрасывает блокировку, failedAttempts и lockUntil")
    void unlockUser_success() {
        user.setAccountLocked(true);
        user.setFailedAttempts(5);
        user.setLockUntil(java.time.LocalDateTime.now().plusMinutes(10));

        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        adminUserService.unlockUser(1L);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());

        User saved = captor.getValue();
        assertThat(saved.isAccountLocked()).isFalse();
        assertThat(saved.getFailedAttempts()).isEqualTo(0);
        assertThat(saved.getLockUntil()).isNull();
    }

    // ── changeRole ────────────────────────────────────────────────────────

    @Test
    @DisplayName("changeRole — меняет роль и сохраняет")
    void changeRole_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        adminUserService.changeRole(1L, Role.ADMIN);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("changeRole — пользователь не найден → UserNotFoundException")
    void changeRole_notFound() {
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.changeRole(99L, Role.ADMIN))
                .isInstanceOf(UserNotFoundException.class);
    }

    // ── resetPassword ─────────────────────────────────────────────────────

    @Test
    @DisplayName("resetPassword — кодирует новый пароль, сбрасывает блокировку и счётчик")
    void resetPassword_success() {
        user.setAccountLocked(true);
        user.setFailedAttempts(3);

        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(encoder.encode("newPass")).willReturn("new_encoded");

        adminUserService.resetPassword(1L, "newPass");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());

        User saved = captor.getValue();
        assertThat(saved.getPassword()).isEqualTo("new_encoded");
        assertThat(saved.getFailedAttempts()).isEqualTo(0);
        assertThat(saved.isAccountLocked()).isFalse();
        assertThat(saved.getLockUntil()).isNull();
        assertThat(saved.getLastPasswordChangeAt()).isNotNull();
    }

    @Test
    @DisplayName("resetPassword — пользователь не найден → UserNotFoundException")
    void resetPassword_notFound() {
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.resetPassword(99L, "pass"))
                .isInstanceOf(UserNotFoundException.class);
    }

    // ── deleteUser ────────────────────────────────────────────────────────

    @Test
    @DisplayName("deleteUser — вызывает delete для существующего пользователя")
    void deleteUser_success() {
        given(userRepository.findById(1L)).willReturn(Optional.of(user));

        adminUserService.deleteUser(1L);

        verify(userRepository).delete(user);
    }

    @Test
    @DisplayName("deleteUser — пользователь не найден → UserNotFoundException")
    void deleteUser_notFound() {
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.deleteUser(99L))
                .isInstanceOf(UserNotFoundException.class);
    }
}
