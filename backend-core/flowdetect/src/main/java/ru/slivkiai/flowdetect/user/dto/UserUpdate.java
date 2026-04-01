package ru.slivkiai.flowdetect.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UserUpdate(
    @Size(min = 2, max = 300, message = "Имя должно быть от 2 до 100 символов")
    String fullName, 
    
    @Email(message = "Неверный формат email")
    String email) {} 