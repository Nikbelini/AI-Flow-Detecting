package ru.slivkiai.flowdetect.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import ru.slivkiai.flowdetect.auth.dto.OtpVerifyRequest;
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.ChangePassword;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.dto.UserUpdate;
import ru.slivkiai.flowdetect.user.service.UserService;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;


@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean  private UserService userService;

    private CustomUserDetails createTestUserDetails(Long id, String email) {
        User mockUser = User.builder()
                .id(id).email(email).password("encoded")
                .accountLocked(false).role(Role.USER).build();
        return new CustomUserDetails(mockUser);
    }

    private UserGetResponse createUserGetResponse(Long id, String email,
                                                   String fullName, Role role) {
        return new UserGetResponse(
                id, email, fullName, role, true, false,
                LocalDateTime.now().toString(), LocalDateTime.now().toString());
    }

    private OtpVerifyRequest createOtpRequest(String otp) {
        return new OtpVerifyRequest("user@example.com", otp, "device-123", null);
    }

    @Test
    void me_shouldReturn200() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        UserGetResponse response = createUserGetResponse(
                1L, "user@example.com", "John Doe", Role.USER);

        when(userService.getMe(testUser.getId())).thenReturn(response);

        mockMvc.perform(get("/api/user/me")
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("user@example.com"))
                .andExpect(jsonPath("$.fullName").value("John Doe"))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        UserUpdate dto = new UserUpdate("John", "new@email.com");
        UserGetResponse updated = createUserGetResponse(
                1L, "new@email.com", "John Doe", Role.USER);

        when(userService.updateMe(eq(testUser.getId()), any(UserUpdate.class))).thenReturn(updated);

        mockMvc.perform(put("/api/user/update")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto))
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new@email.com"));
    }

    @Test
    void changePassword_shouldReturn204() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        ChangePassword dto = new ChangePassword("old123", "new123", "new123");

        doNothing().when(userService).changePassword(testUser.getId(), dto);

        mockMvc.perform(put("/api/user/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto))
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isNoContent());
    }

    @Test
    void requestConfirmation_shouldReturn200() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        doNothing().when(userService).requestConfirmationOtp(testUser.getId());

        mockMvc.perform(post("/api/user/confirm/request")
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        "Код подтверждения отправлен на user@example.com"));
    }

    @Test
    void confirmEmail_shouldReturn200() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        OtpVerifyRequest dto = createOtpRequest("123456");

        doNothing().when(userService)
                .confirmEmailAndEnable2fa(testUser.getId(), "123456");

        mockMvc.perform(post("/api/user/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto))
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        "Почта подтверждена. Двухфакторная аутентификация включена."));
    }

    @Test
    void disableTwoFactor_shouldReturn200() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        OtpVerifyRequest dto = createOtpRequest("654321");

        doNothing().when(userService)
                .disableTwoFactorOnly(testUser.getId(), "654321");

        mockMvc.perform(post("/api/user/2fa/disable")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto))
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        "\uD83D\uDD13 Двухфакторная аутентификация отключена"));
    }

    @Test
    void deleteMe_shouldReturn204() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        doNothing().when(userService).deleteMe(testUser.getId());

        mockMvc.perform(delete("/api/user/me")
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isNoContent());
    }

    @Test
    void confirm_invalidOtpFormat_shouldReturn400() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        String invalidJson = """
                {
                    "email": "user@example.com",
                    "otp": "",
                    "deviceId": "device-123",
                    "resetToken": null
                }
                """;

        mockMvc.perform(post("/api/user/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson)
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isBadRequest());
    }
}