package ru.slivkiai.flowdetect.user.service;

import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.PolicyUpdate;
import ru.slivkiai.flowdetect.user.repository.SecurityPolicyRepository;
import ru.slivkiai.flowdetect.user.repository.UserRepository;

@Service
@RequiredArgsConstructor
public class SecurityPolicyService {

    private final SecurityPolicyRepository securityPolicyRepository;

    private final UserRepository userRepository;

    public void updateMyPolicy(long currentUserId, PolicyUpdate dto) {
        SecurityPolicy policy = securityPolicyRepository.findByUserId(currentUserId)
                .orElseGet(() -> createDefault(currentUserId));

        if (dto.passwordExpirationDays() != null) {
            policy.setPasswordExpirationDays(dto.passwordExpirationDays());
        }

        if (dto.maxFailedAttempts() != null) {
            policy.setMaxFailedAttempts(dto.maxFailedAttempts());
        }

        if (dto.lockDurationSeconds() != null) {
            policy.setLockDurationSeconds(dto.lockDurationSeconds());
        }

        applyPolicyUpdate(policy, dto);
    }

    public void updatePolicyAsAdmin(long targetUserId, PolicyUpdate dto) {
        SecurityPolicy securityPolicy = securityPolicyRepository.findByUserId(targetUserId)
                .orElseGet(() -> createDefault(targetUserId));

        applyPolicyUpdate(securityPolicy, dto);
    }

    @Transactional
    public SecurityPolicy getPolicy(long userId) {
        return securityPolicyRepository.findByUserId(userId)
            .orElseGet(() -> createDefault(userId));
    }

    private void applyPolicyUpdate(SecurityPolicy securityPolicy, PolicyUpdate dto) {
        if (dto.passwordExpirationDays() != null) {
            if (dto.passwordExpirationDays() < 1 || dto.passwordExpirationDays() > 365) {
                throw new IllegalArgumentException("Invalid password expiration");
            }

            securityPolicy.setPasswordExpirationDays(dto.passwordExpirationDays());
        }

        if (dto.maxFailedAttempts() != null) {
            if (dto.maxFailedAttempts() < 1 || dto.maxFailedAttempts() > 10) {
                throw new IllegalArgumentException("Invalid max failed attempts");
            }

            securityPolicy.setMaxFailedAttempts(dto.maxFailedAttempts());
        }

        if (dto.lockDurationSeconds() != null) {
            if (dto.lockDurationSeconds() < 5 || dto.lockDurationSeconds() > 86400) {
                throw new IllegalArgumentException("Invalid lock duration");
            }

            securityPolicy.setLockDurationSeconds(dto.lockDurationSeconds());
        }
    }

    private SecurityPolicy createDefault(long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return securityPolicyRepository.save(SecurityPolicy.builder()
                .user(user)
                .passwordExpirationDays(30)
                .maxFailedAttempts(5)
                .lockDurationSeconds(60)
                .build());
    }

    @Transactional
    public SecurityPolicy createDefaultPolicy(User user) {

        return securityPolicyRepository.save(SecurityPolicy.builder()
                .user(user)
                .passwordExpirationDays(30)
                .maxFailedAttempts(5)
                .lockDurationSeconds(300)
                .build());
    }
}