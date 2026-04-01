package ru.slivkiai.flowdetect.user.service;

import java.time.LocalDateTime;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
                .role(Role.User)
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

    public UserGetResponse updateMe(long userId, UserUpdate dto) {
        User user = getUserOrThrow(userId);

        if (user.isLocked()) {
            throw new IllegalStateException("Account locked");
        }

        if (dto.fullName() != null) {
            user.setFullName(dto.fullName());
        }

        userRepository.save(user);
        return userMapper.toDto(user);
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
