package ru.slivkiai.flowdetect.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.user.controller.AdminUserController;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.dto.UserCreateRequest;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.service.AdminUserService;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminUserController.class)
@ExtendWith(MockitoExtension.class)
class AdminUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AdminUserService adminUserService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    private UserGetResponse userResponse;
    private UserCreateRequest createRequest;

    @BeforeEach
    void setUp() {
        userResponse = new UserGetResponse(
                1L, "user@example.com", "John Doe", Role.USER, false, false, null, null);
        createRequest = new UserCreateRequest("new@example.com", "password", "Jane Doe");
    }

    @Test
    @DisplayName("создание пользователя (ADMIN) — 201, поля в ответе")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createUser_success() throws Exception {
        given(adminUserService.createUser(any(UserCreateRequest.class))).willReturn(userResponse);

        mockMvc.perform(post("/api/admin/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.email").value("user@example.com"))
                .andExpect(jsonPath("$.fullName").value("John Doe"))
                .andExpect(jsonPath("$.role").value("USER"));

        verify(adminUserService).createUser(any(UserCreateRequest.class));
    }

    @Test
    @DisplayName("список пользователей с поиском — 200, пагинация")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getAllUsers_withSearch() throws Exception {
        Page<UserGetResponse> page = new PageImpl<>(List.of(userResponse), PageRequest.of(0, 10), 1);
        given(adminUserService.getAllUsers(eq(Role.USER), eq("john"), any())).willReturn(page);

        mockMvc.perform(get("/api/admin/users")
                .param("role", "USER")
                .param("search", "john")
                .param("page", "0")
                .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].email").value("user@example.com"))
                .andExpect(jsonPath("$.content[0].fullName").value("John Doe"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("список без поиска — 200")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getAllUsers_noSearch() throws Exception {
        Page<UserGetResponse> page = new PageImpl<>(List.of(userResponse), PageRequest.of(0, 10), 1);
        given(adminUserService.getAllUsers(eq(Role.USER), eq(null), any())).willReturn(page);

        mockMvc.perform(get("/api/admin/users")
                .param("role", "USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @DisplayName("получение пользователя по ID — 200")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getUserById_success() throws Exception {
        given(adminUserService.getUser(1L)).willReturn(userResponse);

        mockMvc.perform(get("/api/admin/users/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.email").value("user@example.com"));
    }

    @Test
    @DisplayName("удаление пользователя — 204")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteUser_success() throws Exception {
        mockMvc.perform(delete("/api/admin/users/1"))
                .andExpect(status().isNoContent());

        verify(adminUserService).deleteUser(1L);
    }

    @Test
    @DisplayName("блокировка пользователя — 200")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void lockUser_success() throws Exception {
        mockMvc.perform(post("/api/admin/users/1/lock"))
                .andExpect(status().isOk());

        verify(adminUserService).lockUser(1L);
    }

    @Test
    @DisplayName("разблокировка пользователя — 200")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void unlockUser_success() throws Exception {
        mockMvc.perform(post("/api/admin/users/1/unlock"))
                .andExpect(status().isOk());

        verify(adminUserService).unlockUser(1L);
    }

    @Test
    @DisplayName("смена роли на ADMIN — 200")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void changeRole_toAdmin() throws Exception {
        mockMvc.perform(post("/api/admin/users/1/role")
                .param("role", "ADMIN"))
                .andExpect(status().isOk());

        verify(adminUserService).changeRole(1L, Role.ADMIN);
    }

    @Test
    @DisplayName("смена роли на USER — 200")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void changeRole_toUser() throws Exception {
        mockMvc.perform(post("/api/admin/users/1/role")
                .param("role", "USER"))
                .andExpect(status().isOk());

        verify(adminUserService).changeRole(1L, Role.USER);
    }

    @Test
    @DisplayName("сброс пароля пользователя — 200")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void resetPassword_success() throws Exception {
        mockMvc.perform(post("/api/admin/users/1/reset-password")
                .param("password", "newSecurePassword123"))
                .andExpect(status().isOk());

        verify(adminUserService).resetPassword(1L, "newSecurePassword123");
    }
}