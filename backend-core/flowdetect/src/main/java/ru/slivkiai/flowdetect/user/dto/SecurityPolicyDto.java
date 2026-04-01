package ru.slivkiai.flowdetect.user.dto;

public record SecurityPolicyDto(
    Long id,
    int maxFailedAttempts,
    int lockDurationSeconds,
    int passwordExpirationDays,
    Long userId) {}