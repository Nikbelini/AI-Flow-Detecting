package ru.slivkiai.flowdetect.auth.jwt;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import lombok.Getter;
import lombok.Setter;

@Configuration
@ConfigurationProperties(prefix = "jwt", ignoreInvalidFields = true)
@Getter
@Setter
public class JwtProperties {

    private String key = "";

    // Base64 encoded secret (256-bit min for HS256)
    private String secret;

    // Время истечения срока действия токена в миллисекундах
    private long accessExpirationMs = 1000 * 60 * 15; // 15 минут

    // Обновление токена (длинный)
    private long refreshExpirationMs = 1000 * 60 * 60 * 24 * 7; // 7 дней

    private long resetTokenExpirationMs = 1000 * 60 * 5; // 5 минут (для сброса пароля)
}
