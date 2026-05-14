package ru.slivkiai.flowdetect.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.assertj.core.api.Assertions.assertThat;

class PasswordHashingTest {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Test
    void passwordIsStoredAsHash() {
        String rawPassword = "mySecret123";
        String encoded = encoder.encode(rawPassword);
        
        assertThat(encoded).isNotEqualTo(rawPassword);
        
        assertThat(encoded).startsWith("$2a$10$");
        
        assertThat(encoded).hasSize(60);
        
        assertThat(encoder.matches(rawPassword, encoded)).isTrue();
        
        assertThat(encoder.matches("wrongPassword", encoded)).isFalse();
    }
}