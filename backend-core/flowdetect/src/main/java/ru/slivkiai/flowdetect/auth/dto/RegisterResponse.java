package ru.slivkiai.flowdetect.auth.dto;

public record RegisterResponse(boolean success, String message, String email) {}
