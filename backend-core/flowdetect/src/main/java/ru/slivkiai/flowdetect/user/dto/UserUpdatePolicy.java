package ru.slivkiai.flowdetect.user.dto;

public record UserUpdatePolicy(Integer passwordExpirationDays, Integer maxFailedAttempts, Integer lockDurationSeconds) {}
