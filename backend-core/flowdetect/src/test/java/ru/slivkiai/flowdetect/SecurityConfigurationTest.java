package ru.slivkiai.flowdetect;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
class SecurityConfigurationTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void securityConfigurationIsLoaded() {
        // Проверяем, что Security-бин существует
        assertThat(applicationContext.getBean("springSecurityFilterChain"))
            .isNotNull();
    }
}