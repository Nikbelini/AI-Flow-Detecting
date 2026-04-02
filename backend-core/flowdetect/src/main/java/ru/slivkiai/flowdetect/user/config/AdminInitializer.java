package ru.slivkiai.flowdetect.user.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.repository.SecurityPolicyRepository;
import ru.slivkiai.flowdetect.user.repository.UserRepository;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class AdminInitializer implements CommandLineRunner {

    private final UserRepository userRepository;

    private final SecurityPolicyRepository securityPolicyRepository;

    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {

        String adminEmail = "admin@mail.ru";

        if (userRepository.findByEmail(adminEmail).isPresent()) {
            return;
        }

        User admin = User.builder()
                .email(adminEmail)
                .password(passwordEncoder.encode("admin"))
                .role(Role.ADMIN)
                .fullName("System Admin")
                .accountLocked(false)
                .emailConfirmed(false)
                .twoFactorEnabled(false)
                .failedAttempts(0)
                .lastPasswordChangeAt(LocalDateTime.now())
                .build();

        User savedAdmin = userRepository.save(admin);

        SecurityPolicy adminPolicy = SecurityPolicy.builder()
                .user(savedAdmin)
                .passwordExpirationDays(90) // для админа дольше
                .maxFailedAttempts(3)       // для админа строже
                .lockDurationSeconds(600)   // 10 минут
                .build();

        securityPolicyRepository.save(adminPolicy);

        System.out.println("Default admin created");
    }
}
