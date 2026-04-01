package ru.slivkiai.flowdetect.user.dto;

import java.time.LocalDateTime;

public record DeviceSessionDTO(Long id, String deviceName, String os, String browser,
        String ip, String country, boolean revoked, LocalDateTime lastActiveAt) {}
