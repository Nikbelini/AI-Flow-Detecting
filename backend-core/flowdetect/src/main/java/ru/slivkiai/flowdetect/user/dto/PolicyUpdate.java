package ru.slivkiai.flowdetect.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record PolicyUpdate(
    @Min(value = 1, message = "Минимум 1 день")
    @Max(value = 365, message = "Максимум 365 дней")
    Integer passwordExpirationDays,

    @Min(value = 1, message = "Минимум 1 попытка")
    @Max(value = 10, message = "Максимум 10 попыток")
    Integer maxFailedAttempts,

    @Min(value = 5, message = "Минимум 5 секунд")
    @Max(value = 86400, message = "Максимум 24 часа")
    Integer lockDurationSeconds) {}
