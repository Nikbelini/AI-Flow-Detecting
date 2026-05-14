package ru.slivkiai.flowdetect.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import ru.slivkiai.flowdetect.auth.jwt.JwtProperties;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;

import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JwtServiceTest {

    private JwtService jwtService;

    @Mock
    private JwtProperties jwtProperties;

    private final String secretBase64 = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private final long accessExpMs = 900_000;      // 15 минут
    private final long refreshExpMs = 604_800_000; // 7 дней

    @BeforeEach
    void setUp() {
        given(jwtProperties.getSecret()).willReturn(secretBase64);
        given(jwtProperties.getAccessExpirationMs()).willReturn(accessExpMs);
        given(jwtProperties.getRefreshExpirationMs()).willReturn(refreshExpMs);
        jwtService = new JwtService(jwtProperties);
        jwtService.init();
    }

    @Test
    @DisplayName("1. Access token – содержит все необходимые claims")
    void generateAccessToken_containsCorrectClaims() {
        User user = User.builder()
                .email("user@example.com")
                .role(Role.USER)
                .build();
        String deviceId = "device123";
        String token = jwtService.generateAccessToken(user, deviceId);

        Claims claims = jwtService.extractAllClaim(token);
        assertThat(claims.getSubject()).isEqualTo("user@example.com");
        assertThat(claims.get("role")).isEqualTo("USER");
        assertThat(claims.get("deviceId")).isEqualTo("device123");
        assertThat(claims.get("type")).isEqualTo("access");
        assertThat(claims.getId()).isNotNull();
        assertThat(claims.getExpiration()).isAfter(new Date());
        assertThat(claims.getIssuedAt()).isBefore(new Date());
    }

    @Test
    @DisplayName("2. Refresh token имеет type=refresh и больший срок жизни")
    void generateRefreshToken_hasRefreshTypeAndLongerExpiry() {
        User user = User.builder()
                .email("user@example.com")
                .role(Role.USER)
                .build();
        String deviceId = "device123";
        String refreshToken = jwtService.generateRefreshToken(user, deviceId);
        String accessToken = jwtService.generateAccessToken(user, deviceId);

        Claims refreshClaims = jwtService.extractAllClaim(refreshToken);
        Claims accessClaims = jwtService.extractAllClaim(accessToken);

        assertThat(refreshClaims.get("type")).isEqualTo("refresh");
        assertThat(refreshClaims.getExpiration()).isAfter(accessClaims.getExpiration());
    }

    @Test
    @DisplayName("3. Валидация корректного токена проходит успешно")
    void validateToken_validToken_returnsTrue() {
        User user = User.builder()
                .email("user@example.com")
                .role(Role.USER)
                .build();
        String token = jwtService.generateAccessToken(user, "dev");
        org.springframework.security.core.userdetails.User userDetails =
                new org.springframework.security.core.userdetails.User(user.getEmail(), "", java.util.Collections.emptyList());
        assertThat(jwtService.validateToken(token, userDetails)).isTrue();
    }

    @Test
    @DisplayName("4. Различие access и refresh токенов по методам isAccessToken/isRefreshToken")
    void tokenTypeCheck() {
        User user = User.builder()
                .email("test@ex.com")
                .role(Role.USER)
                .build();
        String access = jwtService.generateAccessToken(user, "dev");
        String refresh = jwtService.generateRefreshToken(user, "dev");

        assertThat(jwtService.isAccessToken(access)).isTrue();
        assertThat(jwtService.isRefreshToken(refresh)).isTrue();
        assertThat(jwtService.isAccessToken(refresh)).isFalse();
        assertThat(jwtService.isRefreshToken(access)).isFalse();
    }

    @Test
    @DisplayName("5. Извлечение deviceId из токена")
    void extractDeviceId_returnsCorrectValue() {
        User user = User.builder()
                .email("test@ex.com")
                .role(Role.USER)
                .build();
        String deviceId = "my-android";
        String token = jwtService.generateAccessToken(user, deviceId);
        assertThat(jwtService.extractDeviceId(token)).isEqualTo(deviceId);
    }
}