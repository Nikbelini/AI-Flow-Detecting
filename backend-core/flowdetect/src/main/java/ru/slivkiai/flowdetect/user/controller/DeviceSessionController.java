package ru.slivkiai.flowdetect.user.controller;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.dto.DeviceSessionDto;
import ru.slivkiai.flowdetect.user.service.DeviceSessionService;

@Slf4j
@RestController
@RequestMapping("/api/user/sessions")
@RequiredArgsConstructor
public class DeviceSessionController {
    
    private final DeviceSessionService sessionService;

    private final JwtService jwtService;

    private String extractSessionIdFromRequest(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("No valid Authorization header found");
            return null;
        }
        
        String token = authHeader.substring(7);
        
        try {
            return jwtService.extractDeviceId(token); 
        } catch (Exception exception) {
            log.warn("Failed to extract sessionId from token: {}", exception.getMessage());
            return null;
        }
    }

    @GetMapping
    public ResponseEntity<List<DeviceSessionDto>> getSessions(
            @AuthenticationPrincipal CustomUserDetails user, 
            HttpServletRequest request) {
        
        String currentSessionId = extractSessionIdFromRequest(request);
        return ResponseEntity.ok(
                sessionService.getActiveSessions(user.getId(), currentSessionId));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> revokeSession(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable String sessionId,
            HttpServletRequest request) {
              
            String currentSessionId = extractSessionIdFromRequest(request);

            if (sessionId.equals(currentSessionId)) {
                log.warn("Attempt to revoke current session: {} for user {}", sessionId, user.getId());
                return ResponseEntity.badRequest().build();
        }

        boolean revoked = sessionService.revokeSession(sessionId, user.getId());
        return revoked ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/all-other")
    public ResponseEntity<Void> revokeAllOther(
            @AuthenticationPrincipal CustomUserDetails user,
            HttpServletRequest request) {
        
        String currentSessionId = extractSessionIdFromRequest(request);

        if (currentSessionId == null) {
            log.warn("Cannot revoke other sessions: sessionId not found in token for user {}", user.getId());
            return ResponseEntity.badRequest().build();
        }

        sessionService.revokeAllOtherSessions(user.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(
            @AuthenticationPrincipal CustomUserDetails user) {
        
        sessionService.revokeAllUserSessions(user.getId());
        return ResponseEntity.noContent().build();
    }
}
