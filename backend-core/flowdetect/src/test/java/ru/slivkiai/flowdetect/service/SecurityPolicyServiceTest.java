package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.PolicyUpdate;
import ru.slivkiai.flowdetect.user.repository.SecurityPolicyRepository;
import ru.slivkiai.flowdetect.user.repository.UserRepository;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SecurityPolicyServiceTest {

    @Mock
    private SecurityPolicyRepository securityPolicyRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SecurityPolicyService securityPolicyService;

    private User user;
    private SecurityPolicy existingPolicy;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).email("test@example.com").build();

        existingPolicy = SecurityPolicy.builder()
                .id(10L)
                .user(user)
                .maxFailedAttempts(5)
                .lockDurationSeconds(60)
                .passwordExpirationDays(30)
                .build();
    }

    @Test
    @DisplayName("getPolicy — возвращает существующую политику")
    void getPolicy_exists() {
        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        SecurityPolicy result = securityPolicyService.getPolicy(1L);

        assertThat(result.getMaxFailedAttempts()).isEqualTo(5);
        assertThat(result.getLockDurationSeconds()).isEqualTo(60);
    }

    @Test
    @DisplayName("getPolicy — политика отсутствует: создаётся дефолтная")
    void getPolicy_createsDefault() {
        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.empty());
        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(securityPolicyRepository.save(any(SecurityPolicy.class))).willAnswer(inv -> inv.getArgument(0));

        SecurityPolicy result = securityPolicyService.getPolicy(1L);

        assertThat(result.getMaxFailedAttempts()).isEqualTo(5);
        assertThat(result.getPasswordExpirationDays()).isEqualTo(30);
        verify(securityPolicyRepository).save(any(SecurityPolicy.class));
    }

    @Test
    @DisplayName("getPolicy — пользователь не найден при создании дефолта → UsernameNotFoundException")
    void getPolicy_userNotFound() {
        given(securityPolicyRepository.findByUserId(99L)).willReturn(Optional.empty());
        given(userRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> securityPolicyService.getPolicy(99L))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    @DisplayName("updateMyPolicy — корректное обновление всех полей")
    void updateMyPolicy_success() {
        PolicyUpdate dto = new PolicyUpdate(60, 7, 120);

        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        securityPolicyService.updateMyPolicy(1L, dto);

        assertThat(existingPolicy.getPasswordExpirationDays()).isEqualTo(60);
        assertThat(existingPolicy.getMaxFailedAttempts()).isEqualTo(7);
        assertThat(existingPolicy.getLockDurationSeconds()).isEqualTo(120);
    }

    @Test
    @DisplayName("updateMyPolicy — maxFailedAttempts=0 → IllegalArgumentException")
    void updateMyPolicy_invalidMaxAttempts() {
        PolicyUpdate dto = new PolicyUpdate(null, 0, null);

        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        assertThatThrownBy(() -> securityPolicyService.updateMyPolicy(1L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid max failed attempts");
    }

    @Test
    @DisplayName("updateMyPolicy — maxFailedAttempts=11 → IllegalArgumentException")
    void updateMyPolicy_maxAttemptsTooHigh() {
        PolicyUpdate dto = new PolicyUpdate(null, 11, null);

        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        assertThatThrownBy(() -> securityPolicyService.updateMyPolicy(1L, dto))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("updateMyPolicy — lockDuration=4 (меньше минимума) → IllegalArgumentException")
    void updateMyPolicy_lockDurationTooLow() {
        PolicyUpdate dto = new PolicyUpdate(null, null, 4);

        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        assertThatThrownBy(() -> securityPolicyService.updateMyPolicy(1L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("lock");
    }

    @Test
    @DisplayName("updateMyPolicy — lockDuration=86401 (больше максимума) → IllegalArgumentException")
    void updateMyPolicy_lockDurationTooHigh() {
        PolicyUpdate dto = new PolicyUpdate(null, 86401, null);

        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        assertThatThrownBy(() -> securityPolicyService.updateMyPolicy(1L, dto))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("updateMyPolicy — passwordExpirationDays=0 → IllegalArgumentException")
    void updateMyPolicy_expirationDaysInvalid() {
        PolicyUpdate dto = new PolicyUpdate(null, null, 0);

        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        assertThatThrownBy(() -> securityPolicyService.updateMyPolicy(1L, dto))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("updateMyPolicy — null-поля не затрагивают текущие значения")
    void updateMyPolicy_nullFieldsIgnored() {
        PolicyUpdate dto = new PolicyUpdate(null, null, null);

        given(securityPolicyRepository.findByUserId(1L)).willReturn(Optional.of(existingPolicy));

        securityPolicyService.updateMyPolicy(1L, dto);

        assertThat(existingPolicy.getMaxFailedAttempts()).isEqualTo(5);
        assertThat(existingPolicy.getLockDurationSeconds()).isEqualTo(60);
        assertThat(existingPolicy.getPasswordExpirationDays()).isEqualTo(30);
    }

    @Test
    @DisplayName("createDefaultPolicy — сохраняет политику с дефолтными значениями для пользователя")
    void createDefaultPolicy_success() {
        given(securityPolicyRepository.save(any(SecurityPolicy.class))).willAnswer(inv -> inv.getArgument(0));

        SecurityPolicy result = securityPolicyService.createDefaultPolicy(user);

        ArgumentCaptor<SecurityPolicy> captor = ArgumentCaptor.forClass(SecurityPolicy.class);
        verify(securityPolicyRepository).save(captor.capture());

        SecurityPolicy saved = captor.getValue();
        assertThat(saved.getUser()).isEqualTo(user);
        assertThat(saved.getPasswordExpirationDays()).isEqualTo(30);
        assertThat(saved.getMaxFailedAttempts()).isEqualTo(5);
        assertThat(saved.getLockDurationSeconds()).isEqualTo(300);
    }
}
