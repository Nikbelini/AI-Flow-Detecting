package ru.slivkiai.flowdetect.auth.dto;

public record AuthResponse(String accessToken, String refreshToken, boolean requireOtp, String email) {}
