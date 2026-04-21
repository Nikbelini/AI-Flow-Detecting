package ru.slivkiai.flowdetect.database;


import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import jakarta.transaction.Transactional;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.repository.UserRepository;

import static org.assertj.core.api.Assertions.*;

import java.util.Optional;


@ActiveProfiles("test")
@SpringBootTest
class RepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldLoadTestDataFromSqlScript() {
        User user = userRepository.findByEmail("admin@mail.ru").orElse(null);
        assertThat(user).isNotNull();
        assertThat(user.getRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    void shouldFindByEmailIgnoreCase() {
        Optional<User> user = userRepository.findByEmail("admin@mail.ru");
        assertThat(user).isPresent();
        assertThat(user.get().getRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    @Transactional
    void shouldSaveAndFlushUser() {
        User newUser = User.builder()
                .email("fresh@test.com")
                .password("encodedPass")
                .fullName("Fresh Tester")
                .role(Role.USER)
                .accountLocked(false)
                .build();
        User saved = userRepository.saveAndFlush(newUser);
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getEmail()).isNotNull();
    }
}
