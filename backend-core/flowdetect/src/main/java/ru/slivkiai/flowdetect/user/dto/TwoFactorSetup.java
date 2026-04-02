package ru.slivkiai.flowdetect.user.dto;

public record TwoFactorSetup(
    String otp,
    boolean enable) {}