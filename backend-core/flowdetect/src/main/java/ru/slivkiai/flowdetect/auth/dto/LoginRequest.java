package ru.slivkiai.flowdetect.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank(message = "Логин не может быть пустым") String email, 
    @NotBlank(message = "Логин не может быть пустым") String password,
    String deviceId) {}
