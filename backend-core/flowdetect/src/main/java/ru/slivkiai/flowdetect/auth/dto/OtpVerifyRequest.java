package ru.slivkiai.flowdetect.auth.dto;

public record OtpVerifyRequest(String email, String otp) {}
