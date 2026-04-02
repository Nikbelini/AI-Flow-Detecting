package ru.slivkiai.flowdetect.auth.dto;

public record ResetPasswordRequest(String email, String newPassword, String otp) {}
