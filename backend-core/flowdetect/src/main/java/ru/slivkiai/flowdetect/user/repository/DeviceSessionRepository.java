package ru.slivkiai.flowdetect.user.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import ru.slivkiai.flowdetect.user.domain.entity.DeviceSession;

public interface DeviceSessionRepository extends JpaRepository<DeviceSession, Long> {
    Optional<DeviceSession> findBySessionId(String sessionId);
    
    List<DeviceSession> findByUserId(Long userId);

    Optional<DeviceSession> findBySessionIdAndUserId(String sessionId, Long userId);
    Optional<DeviceSession> findByUserIdAndDeviceFingerprintAndRevokedFalse(
            Long userId, String fingerprint);
    List<DeviceSession> findByUserIdAndRevokedFalse(Long userId);
}
