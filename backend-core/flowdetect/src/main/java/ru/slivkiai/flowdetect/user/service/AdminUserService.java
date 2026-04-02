package ru.slivkiai.flowdetect.user.service;

import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.UserCreateRequest;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.exception.UserNotFoundException;
import ru.slivkiai.flowdetect.user.mapper.UserMapper;
import ru.slivkiai.flowdetect.user.repository.UserRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;

    private final UserMapper userMapper;

    private final PasswordEncoder encoder;

    @Transactional
    public UserGetResponse createUser(UserCreateRequest dto) {
        User user = userMapper.toEntity(dto);

        user.setEmail(dto.email());
        user.setFullName(dto.fullName());
        
        user.setEmailConfirmed(false);
        user.setAccountLocked(false);

        user.setPassword(encoder.encode(dto.password()));
        user.setRole(Role.USER);

        return userMapper.toDto(userRepository.save(user));
    }
    
    @Transactional
    public Page<UserGetResponse> getAllUsers(Role role, String search, Pageable pageable) {
        Page<User> users = (search == null || search.isBlank())
            ? userRepository.findAll(pageable)
            : userRepository.findByRoleAndFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(role, search, search, pageable);

        return users.map(userMapper::toDto);
    }

    public UserGetResponse getUser(long id) {
        return userMapper.toDto(getUserOrThrow(id));
    }

    public void lockUser(long id) {
        User user = getUserOrThrow(id);
        user.setAccountLocked(true);
         userRepository.save(user);
    }

    public void unlockUser(long id) {
        User user = getUserOrThrow(id);
        user.setAccountLocked(false);
        user.setFailedAttempts(0);
        user.setLockUntil(null);
        userRepository.save(user);
    }

    public void changeRole(long id, Role role) {
        User user = getUserOrThrow(id);
        user.setRole(role);
        userRepository.save(user);
    }

    public void resetPassword(long id, String newPassword) {
        User user = getUserOrThrow(id);

         String encodedPassword = encoder.encode(newPassword);
        
        user.setPassword(encodedPassword);
        
        user.setLastPasswordChangeAt(LocalDateTime.now());
        user.setFailedAttempts(0);
        user.setAccountLocked(false);
        user.setLockUntil(null);
        
        userRepository.save(user);
    }

    @Transactional
    public void deleteUser(long id) {
        userRepository.delete(getUserOrThrow(id));
    }

    private User getUserOrThrow(long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }
}
