// package ru.slivkiai.flowdetect.database;

// import org.junit.jupiter.api.Test;
// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.boot.test.context.SpringBootTest;
// import org.springframework.test.context.DynamicPropertyRegistry;
// import org.springframework.test.context.DynamicPropertySource;
// import org.testcontainers.containers.PostgreSQLContainer;
// import org.testcontainers.junit.jupiter.Container;
// import org.testcontainers.junit.jupiter.Testcontainers;

// import ru.slivkiai.flowdetect.user.repository.UserRepository;

// import static org.assertj.core.api.Assertions.*;

// @SpringBootTest
// @Testcontainers
// class PostgreSqlIntegrationTest {

//     @Container
//     static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
//             .withDatabaseName("testdb")
//             .withUsername("test")
//             .withPassword("test");

//     @DynamicPropertySource
//     static void configureProperties(DynamicPropertyRegistry registry) {
//         registry.add("spring.datasource.url", postgres::getJdbcUrl);
//         registry.add("spring.datasource.username", postgres::getUsername);
//         registry.add("spring.datasource.password", postgres::getPassword);
//     }

//     @Autowired
//     private UserRepository userRepository;

//     @Test
//     void shouldConnectToRealPostgreSQL() {
//         // Проверка, что контейнер запущен
//         assertThat(postgres.isRunning()).isTrue();

//         // Проверка, что можно выполнить запрос к БД через репозиторий
//         long count = userRepository.count();
//         assertThat(count).isEqualTo(0); // пустая БД после старта
//     }
// }
