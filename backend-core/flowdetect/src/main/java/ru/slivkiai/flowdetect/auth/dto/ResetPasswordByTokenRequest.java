package ru.slivkiai.flowdetect.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordByTokenRequest(
    @NotBlank String resetToken,
    @NotBlank @Size(min = 5) String newPassword) {}
