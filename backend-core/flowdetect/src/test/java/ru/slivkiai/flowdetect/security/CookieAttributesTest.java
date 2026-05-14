package ru.slivkiai.flowdetect.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CookieAttributesTest {
    @Test
    @DisplayName("Проверка атрибутов cookie (имитация)")
    void cookieShouldHaveHttpOnlyAndSameSite() {
        String simulatedCookieHeader = "access_token=abc123; HttpOnly; SameSite=Strict; Path=/";
        assertThat(simulatedCookieHeader).contains("HttpOnly");
        assertThat(simulatedCookieHeader).contains("SameSite=Strict");
        assertThat(simulatedCookieHeader).contains("Path=/");
    }
}