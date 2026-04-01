package ru.slivkiai.flowdetect.user.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.UserCreateRequest;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface UserMapper {
    
    UserGetResponse toDto(User user);

    List<UserGetResponse> toDtoList(List<User> users);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "emailConfirmed", constant = "false")
    @Mapping(target = "accountLocked", constant = "false")
    @Mapping(target = "failedAttempts", constant = "0")
    @Mapping(target = "twoFactorEnabled", constant = "false")
    @Mapping(target = "lastPasswordChangeAt", expression = "java(java.time.LocalDateTime.now())")
    User toEntity(UserCreateRequest dto);
}
