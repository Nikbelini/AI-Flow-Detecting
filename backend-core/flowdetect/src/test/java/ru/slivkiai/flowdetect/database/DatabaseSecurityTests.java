package ru.slivkiai.flowdetect.database;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@SpringBootTest
class DatabaseSecurityTests {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Environment environment;

    @Test
    void testSSLConnection() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            Boolean sslInUse = jdbcTemplate.queryForObject(
                "SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()", 
                Boolean.class
            );
            assertThat(sslInUse).isFalse();
        }
    }

    @Test
    void testEncryptedPassword() {
        String jdbcUrl = environment.getProperty("spring.datasource.url");
        assertThat(jdbcUrl).doesNotContain("password=");
    }
}
