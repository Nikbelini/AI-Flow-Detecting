package ru.slivkiai.flowdetect.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(   
    @NotBlank(message = "Email обязателен")
    @Email(message = "Неверный формат email")
    String email,

    @NotBlank(message = "Пароль обязателен")
    @Size(min = 5, message = "Пароль минимум 5 символов")
    String password, 
    
    @NotBlank(message = "Имя обязательно")
    @Size(min = 2, max = 100, message = "Имя от 2 до 100 символов")
    String fullName) {}
