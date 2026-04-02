package ru.slivkiai.flowdetect.user.service;

import java.time.LocalDateTime;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ru.slivkiai.flowdetect.auth.service.OtpService;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.ChangePassword;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.dto.UserUpdate;
import ru.slivkiai.flowdetect.user.exception.UserNotFoundException;
import ru.slivkiai.flowdetect.user.mapper.UserMapper;
import ru.slivkiai.flowdetect.user.repository.UserRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;

    private final UserMapper userMapper;

    private final PasswordEncoder encoder;

    private final SecurityPolicyService securityPolicyService;

    private final OtpService otpService;  

    @Transactional
    public UserGetResponse createUser(String email, String rawPassword, String fullName) {

        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists");
        }

        String encodedPassword = encoder.encode(rawPassword);

        User user = User.builder()
                .email(email)
                .password(encodedPassword)
                .fullName(fullName)
                .role(Role.USER)
                .accountLocked(false)
                .emailConfirmed(false)
                .twoFactorEnabled(false)
                .accountLocked(false)
                .failedAttempts(0)
                .lastPasswordChangeAt(LocalDateTime.now())
                .lastLoginAt(null)
                .build();

        User savedUser = userRepository.save(user);

        // создаём дефолтную security policy
        securityPolicyService.createDefaultPolicy(savedUser);

        log.info("User created: {}", savedUser.getEmail());

        return userMapper.toDto(savedUser);
    }

    @Transactional
    public UserGetResponse getMe(long userId) {
        User user = getUserOrThrow(userId);
        return userMapper.toDto(user);
    }

    @Transactional
    public UserGetResponse updateMe(long userId, UserUpdate dto) {
        User user = getUserOrThrow(userId);

        if (user.isLocked()) {
            throw new IllegalStateException("Account locked");
        }

        if (dto.fullName() != null && !dto.fullName().isBlank()) {
            user.setFullName(dto.fullName().trim());
        }

        if (dto.email() != null && !dto.email().isBlank() && !dto.email().equals(user.getEmail())) {
             String newEmail = dto.email().toLowerCase().trim();
            
            if (userRepository.existsByEmail(newEmail)) {
                throw new IllegalArgumentException("Email уже используется");
            }
            
            user.setEmail(newEmail);
            user.setEmailConfirmed(false);
            user.setTwoFactorEnabled(false);
        }

        User updated = userRepository.save(user);
        
        log.info("Profile updated for user {}: email={}, fullName={}", 
                userId, updated.getEmail(), updated.getFullName());
        return userMapper.toDto(updated);
    }

    @Transactional
    public void requestConfirmationOtp(long userId) {
        User user = getUserOrThrow(userId);
        
        if (user.isEmailConfirmed()) {
            throw new IllegalStateException("Почта уже подтверждена. 2FA можно отключить в настройках");
        }
        
        otpService.generateAndSendOtp(user.getEmail());
        log.info("Confirmation OTP sent to {}", user.getEmail());
    }

    @Transactional
    public void confirmEmailAndEnable2fa(long userId, String otp) {
        User user = getUserOrThrow(userId);
        
        if (user.isEmailConfirmed()) {
            throw new IllegalStateException("Почта уже подтверждена");
        }
        
        boolean verified = otpService.verifyOtp(user.getEmail(), otp);
        if (!verified) {
            throw new IllegalArgumentException("Неверный или истёкший код");
        }
        
        user.setEmailConfirmed(true);
        user.setTwoFactorEnabled(true);
        userRepository.save(user);
        
        log.info("Email confirmed + 2FA enabled for user {}", user.getEmail());
    }

    @Transactional
    public void disableTwoFactorOnly(long userId, String otp) {
        User user = getUserOrThrow(userId);
        
        if (!user.isTwoFactorEnabled()) {
            throw new IllegalStateException("2FA уже выключена");
        }
        
        // Требуем подтвердить действие через OTP (безопасность)
        boolean verified = otpService.verifyOtp(user.getEmail(), otp);
        if (!verified) {
            throw new IllegalArgumentException("Неверный код подтверждения");
        }
        
        user.setTwoFactorEnabled(false);
        userRepository.save(user);
        
        log.info("2FA disabled for user {} (email still confirmed)", user.getEmail());
    }

    public boolean requiresOtpForLogin(User user) {
        return user.isTwoFactorEnabled();
    }

    public void changePassword(long userId, ChangePassword dto) {
        User user = getUserOrThrow(userId);

        if (!encoder.matches(dto.oldPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Wrong password");
        }

        if (!dto.newPassword().equals(dto.confirmPassword())) {
            throw new IllegalArgumentException("Password do not match");
        }

        user.setPassword((encoder.encode(dto.newPassword())));
        user.setLastPasswordChangeAt(LocalDateTime.now());

        userRepository.save(user);
    }

    public void deleteMe(long userId) {
        userRepository.delete(getUserOrThrow(userId));
    }

    private User getUserOrThrow(long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }
}
