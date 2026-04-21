package ru.slivkiai.flowdetect.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.DeviceSessionDto;
import ru.slivkiai.flowdetect.user.service.DeviceSessionService;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class DeviceSessionControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private DeviceSessionService sessionService;
    @MockBean private JwtService jwtService;

    private CustomUserDetails testUser;

    @BeforeEach
    void setUp() {
        User mockUser = User.builder()
                .id(1L).email("test@example.com").password("encoded")
                .accountLocked(false).role(Role.USER).build();
        testUser = new CustomUserDetails(mockUser);
    }

    @Test
    void getSessions_shouldReturn200() throws Exception {
        DeviceSessionDto session = new DeviceSessionDto(
                "device-123", "192.168.1.1", "Russia", "Chrome", "Windows",
                "Desktop", LocalDateTime.now(), LocalDateTime.now(), true, false);

        when(jwtService.extractDeviceId("valid.jwt")).thenReturn("device-123");
        when(sessionService.getActiveSessions(1L, "device-123")).thenReturn(List.of(session));

        mockMvc.perform(get("/api/user/sessions")
                        .header("Authorization", "Bearer valid.jwt")
                        .with(user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sessionId").value("device-123"));
    }

    @Test
    void revokeSession_shouldReturn204() throws Exception {
        when(sessionService.revokeSession("device-123", 1L)).thenReturn(true);

        mockMvc.perform(delete("/api/user/sessions/device-123")
                        .with(user(testUser)))
                .andExpect(status().isNoContent());
    }

    @Test
    void revokeSession_notFound_shouldReturn404() throws Exception {
        when(sessionService.revokeSession("unknown-device", 1L)).thenReturn(false);

        mockMvc.perform(delete("/api/user/sessions/unknown-device")
                        .with(user(testUser)))
                .andExpect(status().isNotFound());
    }

    @Test
    void revokeAllOther_missingAuthHeader_shouldReturn400() throws Exception {
        // Без заголовка Authorization контроллер вернёт 400
        // (extractSessionIdFromRequest вернёт null → badRequest)
        mockMvc.perform(delete("/api/user/sessions/all-other")
                        .with(user(testUser)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void revokeAllOther_validToken_shouldReturn204() throws Exception {
        when(jwtService.extractDeviceId("valid.jwt")).thenReturn("device-123");
        when(sessionService.revokeAllOtherSessions("device-123", 1L)).thenReturn(1);

        mockMvc.perform(delete("/api/user/sessions/all-other")
                        .header("Authorization", "Bearer valid.jwt")
                        .with(user(testUser)))
                .andExpect(status().isNoContent());
    }

    @Test
    void logoutAll_shouldReturn204() throws Exception {
        doNothing().when(sessionService).revokeAllUserSessions(1L);

        mockMvc.perform(delete("/api/user/sessions/logout-all")
                        .with(user(testUser)))
                .andExpect(status().isNoContent());
    }

    @ControllerAdvice
        static class TestExceptionHandler {
        @ExceptionHandler(RuntimeException.class)
        public ResponseEntity<Void> handleRuntimeException(RuntimeException e) {
            return ResponseEntity.status(500).build();
        }
    }
}