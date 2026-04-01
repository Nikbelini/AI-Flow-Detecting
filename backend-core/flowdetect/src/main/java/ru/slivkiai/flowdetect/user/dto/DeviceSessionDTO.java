package ru.slivkiai.flowdetect.user.dto;

import java.time.LocalDateTime;

public record DeviceSessionDto(
    String sessionId,
    String ip,
    String country,
    String browser,
    String os,
    String deviceName,
    LocalDateTime createdAt,
    LocalDateTime lastActiveAt,
    boolean currentSession,
    boolean revoked) {}
