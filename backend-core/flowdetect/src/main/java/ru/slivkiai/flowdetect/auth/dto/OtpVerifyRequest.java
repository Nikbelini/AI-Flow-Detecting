package ru.slivkiai.flowdetect.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record OtpVerifyRequest(
    @NotBlank(message = "Email не может быть пустым")
    @Email
    String email, 
    
    @NotBlank(message = "OTP не может быть пустым")
    String otp, 
    
    String deviceId, 
    String resetToken) {}
