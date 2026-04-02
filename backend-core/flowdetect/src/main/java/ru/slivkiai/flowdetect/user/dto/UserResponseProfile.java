package ru.slivkiai.flowdetect.user.dto;

public record UserResponseProfile(String email, String fullName, boolean emailConfirmed,
    boolean accountLocked, boolean twoFactorEnabled, int failedAttempts) {} 