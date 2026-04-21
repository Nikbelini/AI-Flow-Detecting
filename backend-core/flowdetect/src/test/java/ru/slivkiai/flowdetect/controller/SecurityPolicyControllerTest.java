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
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.dto.PolicyUpdate;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityPolicyControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean  private SecurityPolicyService securityPolicyService;

    private CustomUserDetails createTestUserDetails(Long id, String email) {
        User mockUser = User.builder()
                .id(id).email(email).password("encoded")
                .accountLocked(false).role(Role.USER).build();
        return new CustomUserDetails(mockUser);
    }

    @Test
    void getMyPolicy_shouldReturn200() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        User policyUser = User.builder().id(1L).build();
        SecurityPolicy policy = SecurityPolicy.builder()
                .id(100L).user(policyUser)
                .passwordExpirationDays(90)
                .maxFailedAttempts(5)
                .lockDurationSeconds(1800)
                .build();

        when(securityPolicyService.getPolicy(testUser.getId())).thenReturn(policy);

        mockMvc.perform(get("/api/user/policy")
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxFailedAttempts").value(5))
                .andExpect(jsonPath("$.passwordExpirationDays").value(90))
                .andExpect(jsonPath("$.lockDurationSeconds").value(1800));
    }

    @Test
    void updateMyPolicy_valid_shouldReturn200() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        PolicyUpdate dto = new PolicyUpdate(60, 10, 3600);
        User policyUser = User.builder().id(1L).build();
        SecurityPolicy updated = SecurityPolicy.builder()
                .id(100L).user(policyUser)
                .passwordExpirationDays(60)
                .maxFailedAttempts(5)
                .lockDurationSeconds(3600)
                .build();

        doNothing().when(securityPolicyService).updateMyPolicy(testUser.getId(), dto);
        when(securityPolicyService.getPolicy(testUser.getId())).thenReturn(updated);

        mockMvc.perform(put("/api/user/policy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto))
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lockDurationSeconds").value(3600));
    }

    @Test
    void updateMyPolicy_invalidPayload_shouldReturn400() throws Exception {
        CustomUserDetails testUser = createTestUserDetails(1L, "user@example.com");
        String invalidJson =
                "{\"maxFailedAttempts\":-1,\"lockDurationSeconds\":-100,\"passwordExpirationDays\":0}";

        mockMvc.perform(put("/api/user/policy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson)
                        .with(SecurityMockMvcRequestPostProcessors.user(testUser)))
                .andExpect(status().isBadRequest());
    }
}