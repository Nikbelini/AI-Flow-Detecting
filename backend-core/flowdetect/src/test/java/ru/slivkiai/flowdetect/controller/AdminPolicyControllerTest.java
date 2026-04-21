package ru.slivkiai.flowdetect.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.user.controller.AdminPolicyController;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.PolicyUpdate;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminPolicyController.class)
@ExtendWith(MockitoExtension.class)
class AdminPolicyControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @Autowired
        private ObjectMapper objectMapper;

        @MockBean
        private SecurityPolicyService securityPolicyService;

        @MockBean
        private JwtService jwtService;

        @MockBean
        private UserDetailsService userDetailsService;

        @Test
        @DisplayName("обновление политики безопасности — 200")
        @WithMockUser(username = "admin", roles = { "ADMIN" })
        void updatePolicy_success() throws Exception {
                // (passwordExpirationDays=7, maxFailedAttempts=120, lockDurationSeconds=60)
                // для контроллера порядок не важен — просто проверяем что метод вызван
                PolicyUpdate policyUpdate = new PolicyUpdate(30, 5, 60);

                mockMvc.perform(put("/api/admin/policy/1")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(policyUpdate)))
                                .andExpect(status().isOk());

                verify(securityPolicyService).updatePolicyAsAdmin(eq(1L), any(PolicyUpdate.class));
        }

        @Test
        @DisplayName("обновление с null-полями — 200 (частичное обновление)")
        @WithMockUser(username = "admin", roles = { "ADMIN" })
        void updatePolicy_partialUpdate() throws Exception {
                PolicyUpdate policyUpdate = new PolicyUpdate(null, 3, null);

                mockMvc.perform(put("/api/admin/policy/1")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(policyUpdate)))
                                .andExpect(status().isOk());

                verify(securityPolicyService).updatePolicyAsAdmin(eq(1L), any(PolicyUpdate.class));
        }

        @Test
        @DisplayName("получение политики пользователя — 200, поля в ответе")
        @WithMockUser(username = "admin", roles = { "ADMIN" })
        void getPolicy_success() throws Exception {
                User user = User.builder().id(1L).email("test@example.com").build();

                SecurityPolicy policy = SecurityPolicy.builder()
                                .id(10L)
                                .user(user)
                                .maxFailedAttempts(5)
                                .lockDurationSeconds(300)
                                .passwordExpirationDays(30)
                                .build();

                given(securityPolicyService.getPolicy(1L)).willReturn(policy);

                mockMvc.perform(get("/api/admin/policy/1"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.maxFailedAttempts").value(5))
                                .andExpect(jsonPath("$.lockDurationSeconds").value(300))
                                .andExpect(jsonPath("$.passwordExpirationDays").value(30));
        }

        @Test
        @DisplayName("получение политики несуществующего пользователя — сервис бросает исключение → 500")
        @WithMockUser(username = "admin", roles = { "ADMIN" })
        void getPolicy_notFound() throws Exception {
                given(securityPolicyService.getPolicy(99L))
                                .willThrow(new RuntimeException("User not found"));

                assertThatThrownBy(() -> mockMvc.perform(get("/api/admin/policy/99"))
                                .andExpect(status().isOk())).hasRootCauseInstanceOf(RuntimeException.class)
                                .hasRootCauseMessage("User not found");
        }
}