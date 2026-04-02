package ru.slivkiai.flowdetect.user.dto;

import ru.slivkiai.flowdetect.user.domain.entity.Role;

public record UserGetResponse(long id, String email, String fullName,
        Role role, boolean emailConfirmed, boolean twoFactorEnabled,
        String createdAt, String lastLoginAt) {} 