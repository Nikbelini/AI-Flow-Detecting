package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.user.domain.entity.DeviceSession;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.DeviceSessionDto;
import ru.slivkiai.flowdetect.user.repository.DeviceSessionRepository;
import ru.slivkiai.flowdetect.user.service.DeviceSessionService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;


@ExtendWith(MockitoExtension.class)
class DeviceSessionServiceTest {

        @Mock
        private DeviceSessionRepository sessionRepository;

        @InjectMocks
        private DeviceSessionService sessionService;

        private DeviceSession activeSession;
        private DeviceSession otherSession;
        private User testUser;

        @BeforeEach
        void setUp() {
                testUser = User.builder()
                                .id(1L)
                                .email("test@example.com")
                                .build();

                activeSession = DeviceSession.builder()
                                .id(100L)
                                .sessionId("session-123")
                                .user(testUser)
                                .browser("Chrome")
                                .deviceName("Desktop-PC")
                                .os("Windows")
                                .ip("192.168.1.1")
                                .country("Russia")
                                .userAgent("Mozilla/5.0...")
                                .deviceFingerprint("fp-hash-123")
                                .createdAt(LocalDateTime.now().minusDays(1))
                                .lastActiveAt(LocalDateTime.now().minusMinutes(5))
                                .revoked(false)
                                .build();

                otherSession = DeviceSession.builder()
                                .id(101L)
                                .sessionId("session-456")
                                .user(testUser)
                                .browser("Firefox")
                                .deviceName("Laptop")
                                .os("Linux")
                                .ip("192.168.1.2")
                                .country("Russia")
                                .userAgent("Mozilla/5.0...")
                                .deviceFingerprint("fp-hash-456")
                                .createdAt(LocalDateTime.now().minusDays(10))
                                .lastActiveAt(LocalDateTime.now().minusDays(8))
                                .revoked(false)
                                .build();
        }

        @Test
        @DisplayName("getActiveSessions — возвращает все активные сессии пользователя")
        void getActiveSessions_returnsActiveSessions() {
                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(activeSession, otherSession));

                List<DeviceSessionDto> result = sessionService.getActiveSessions(1L, "session-123");

                assertThat(result).hasSize(2);
                assertThat(result).extracting(DeviceSessionDto::sessionId)
                                .containsExactlyInAnyOrder("session-123", "session-456");
        }

        @Test
        @DisplayName("getActiveSessions — текущая сессия помечается флагом currentSession=true")
        void getActiveSessions_currentSessionFlaggedCorrectly() {
                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(activeSession, otherSession));

                List<DeviceSessionDto> result = sessionService.getActiveSessions(1L, "session-123");

                DeviceSessionDto current = result.stream()
                                .filter(s -> s.sessionId().equals("session-123"))
                                .findFirst().orElseThrow();
                DeviceSessionDto other = result.stream()
                                .filter(s -> s.sessionId().equals("session-456"))
                                .findFirst().orElseThrow();

                assertThat(current.currentSession()).isTrue();
                assertThat(other.currentSession()).isFalse();
        }

        @Test
        @DisplayName("getActiveSessions — отозванные сессии исключаются")
        void getActiveSessions_excludesRevokedSessions() {
                DeviceSession revokedSession = DeviceSession.builder()
                                .id(102L)
                                .sessionId("session-revoked")
                                .user(testUser)
                                .browser("Edge")
                                .os("Windows")
                                .deviceName("PC")
                                .ip("10.0.0.1")
                                .country("Russia")
                                .userAgent("Mozilla/5.0...")
                                .deviceFingerprint("fp-revoked")
                                .createdAt(LocalDateTime.now().minusDays(5))
                                .lastActiveAt(LocalDateTime.now().minusDays(5))
                                .revoked(true)
                                .build();

                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(activeSession, revokedSession));

                List<DeviceSessionDto> result = sessionService.getActiveSessions(1L, "session-123");

                assertThat(result).hasSize(1);
                assertThat(result.get(0).sessionId()).isEqualTo("session-123");
        }

        @Test
        @DisplayName("getActiveSessions — возвращает пустой список, если нет сессий")
        void getActiveSessions_emptyList() {
                given(sessionRepository.findByUserId(1L)).willReturn(List.of());

                List<DeviceSessionDto> result = sessionService.getActiveSessions(1L, "session-123");

                assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("getActiveSessions — сортировка по lastActiveAt убыванию")
        void getActiveSessions_sortedByLastActiveAtDesc() {
                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(otherSession, activeSession));

                List<DeviceSessionDto> result = sessionService.getActiveSessions(1L, "session-123");

                // activeSession.lastActiveAt минус 5 минут — новее
                assertThat(result.get(0).sessionId()).isEqualTo("session-123");
                assertThat(result.get(1).sessionId()).isEqualTo("session-456");
        }

        @Test
        @DisplayName("revokeSession — успешный отзыв: флаг revoked=true и сохранение")
        void revokeSession_success() {
                given(sessionRepository.findBySessionIdAndUserId("session-123", 1L))
                                .willReturn(Optional.of(activeSession));

                boolean result = sessionService.revokeSession("session-123", 1L);

                assertThat(result).isTrue();

                ArgumentCaptor<DeviceSession> captor = ArgumentCaptor.forClass(DeviceSession.class);
                verify(sessionRepository).save(captor.capture());

                DeviceSession saved = captor.getValue();
                assertThat(saved.isRevoked()).isTrue();
                assertThat(saved.getSessionId()).isEqualTo("session-123");

                verify(sessionRepository, never()).delete(any(DeviceSession.class));
        }

        @Test
        @DisplayName("revokeSession — сессия не найдена: возвращает false, репозиторий не вызывается")
        void revokeSession_notFound() {
                given(sessionRepository.findBySessionIdAndUserId("session-999", 1L))
                                .willReturn(Optional.empty());

                boolean result = sessionService.revokeSession("session-999", 1L);

                assertThat(result).isFalse();
                verify(sessionRepository, never()).save(any(DeviceSession.class));
                verify(sessionRepository, never()).delete(any(DeviceSession.class));
        }

        @Test
        @DisplayName("revokeAllOtherSessions — отзывает все сессии кроме текущей")
        void revokeAllOtherSessions_success() {
                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(activeSession, otherSession));

                sessionService.revokeAllOtherSessions("session-123", 1L);

                assertThat(otherSession.isRevoked()).isTrue();
                assertThat(activeSession.isRevoked()).isFalse();

                verify(sessionRepository).saveAll(any());
        }

        @Test
        @DisplayName("revokeAllOtherSessions — если нет других активных сессий, saveAll не вызывается с изменениями")
        void revokeAllOtherSessions_noOtherSessions() {
                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(activeSession));

                int count = sessionService.revokeAllOtherSessions("session-123", 1L);

                assertThat(count).isEqualTo(0);
                // saveAll не вызывается, если нечего отзывать
                verify(sessionRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("revokeAllOtherSessions — возвращает количество отозванных сессий")
        void revokeAllOtherSessions_returnsCount() {
                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(activeSession, otherSession));

                int count = sessionService.revokeAllOtherSessions("session-123", 1L);

                assertThat(count).isEqualTo(1);
        }

        @Test
        @DisplayName("revokeAllUserSessions — помечает все сессии пользователя как revoked")
        void revokeAllUserSessions_success() {
                given(sessionRepository.findByUserId(1L))
                                .willReturn(List.of(activeSession, otherSession));

                sessionService.revokeAllUserSessions(1L);

                assertThat(activeSession.isRevoked()).isTrue();
                assertThat(otherSession.isRevoked()).isTrue();

                ArgumentCaptor<List<DeviceSession>> captor = ArgumentCaptor.forClass(List.class);
                verify(sessionRepository).saveAll(captor.capture());

                List<DeviceSession> saved = captor.getValue();
                assertThat(saved).allMatch(DeviceSession::isRevoked);
                assertThat(saved).extracting(DeviceSession::getSessionId)
                                .containsExactlyInAnyOrder("session-123", "session-456");
        }

        @Test
        @DisplayName("revokeAllUserSessions — при пустом списке saveAll вызывается с пустой коллекцией")
        void revokeAllUserSessions_empty() {
                given(sessionRepository.findByUserId(1L)).willReturn(List.of());

                sessionService.revokeAllUserSessions(1L);

                verify(sessionRepository).saveAll(List.of());
        }

        @Test
        @DisplayName("isSessionValid — активная сессия возвращает true")
        void isSessionValid_activeSession() {
                given(sessionRepository.findBySessionId("session-123"))
                                .willReturn(Optional.of(activeSession));

                assertThat(sessionService.isSessionValid("session-123")).isTrue();
        }

        @Test
        @DisplayName("isSessionValid — отозванная сессия возвращает false")
        void isSessionValid_revokedSession() {
                activeSession.setRevoked(true);
                given(sessionRepository.findBySessionId("session-123"))
                                .willReturn(Optional.of(activeSession));

                assertThat(sessionService.isSessionValid("session-123")).isFalse();
        }

        @Test
        @DisplayName("isSessionValid — несуществующая сессия возвращает false")
        void isSessionValid_notFound() {
                given(sessionRepository.findBySessionId("session-999"))
                                .willReturn(Optional.empty());

                assertThat(sessionService.isSessionValid("session-999")).isFalse();
        }

        @Test
        @DisplayName("updateActivity — обновляет lastActiveAt для существующей сессии")
        void updateActivity_updatesTimestamp() {
                LocalDateTime before = LocalDateTime.now().minusSeconds(10);
                given(sessionRepository.findBySessionId("session-123"))
                                .willReturn(Optional.of(activeSession));

                sessionService.updateActivity("session-123");

                ArgumentCaptor<DeviceSession> captor = ArgumentCaptor.forClass(DeviceSession.class);
                verify(sessionRepository).save(captor.capture());

                assertThat(captor.getValue().getLastActiveAt()).isAfter(before);
        }

        @Test
        @DisplayName("updateActivity — несуществующая сессия: репозиторий save не вызывается")
        void updateActivity_sessionNotFound() {
                given(sessionRepository.findBySessionId("session-999"))
                                .willReturn(Optional.empty());

                sessionService.updateActivity("session-999");

                verify(sessionRepository, never()).save(any());
        }
}