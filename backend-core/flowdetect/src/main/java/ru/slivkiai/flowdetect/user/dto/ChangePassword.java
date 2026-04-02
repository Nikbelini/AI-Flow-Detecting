package ru.slivkiai.flowdetect.user.dto;

public record ChangePassword(String oldPassword, String newPassword, String confirmPassword) {}
