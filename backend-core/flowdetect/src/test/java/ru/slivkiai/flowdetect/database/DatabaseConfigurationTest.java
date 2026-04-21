package ru.slivkiai.flowdetect.database;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class DatabaseConfigurationTest {
    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void shouldInjectDataSource() {
        assertThat(dataSource).isNotNull();
    }

    @Test
    void shouldConnectToDatabase() throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            assertThat(conn).isNotNull();
            assertThat(conn.getMetaData().getURL()).contains("jdbc:postgresql://localhost:5432/stops");
        }
    }

    @Test
    void shouldExecuteQuery() {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES", Integer.class);
        assertThat(count).isGreaterThan(0); // есть системные таблицы H2
    }
}
