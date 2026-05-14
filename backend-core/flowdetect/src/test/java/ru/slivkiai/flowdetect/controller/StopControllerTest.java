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
import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;
import ru.slivkiai.flowdetect.service.StopService;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StopControllerImpl.class)
@ExtendWith(MockitoExtension.class)
public class StopControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private StopService stopService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    @DisplayName("Создание остановки (позитивный) – 200, поля в ответе")
    @WithMockUser(roles = "ADMIN")
    void createStop_success() throws Exception {
        StopRequest request = new StopRequest("http://camera.com", "ул. Ленина, 1", 10, 5, 60, 55.7558, 37.6176, 1L);
        StopResponse response = StopResponse.builder()
                .id(100L).address("ул. Ленина, 1").count(10).load(60).velocity(5)
                .lat(55.7558).lng(37.6176).hasCamera(true).build();
        given(stopService.createStop(any(StopRequest.class))).willReturn(response);

        mockMvc.perform(post("/stops")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100L))
                .andExpect(jsonPath("$.address").value("ул. Ленина, 1"));
    }

    @Test
    @DisplayName("Получение всех остановок (позитивный) – 200, ключ stops")
    @WithMockUser
    void getStops_success() throws Exception {
        StopResponse stop = StopResponse.builder().id(1L).address("Test").build();
        given(stopService.getAllStops()).willReturn(List.of(stop));
        mockMvc.perform(get("/stops"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stops.length()").value(1));
    }

    @Test
    @DisplayName("Обновление статистики остановки (позитивный) – 200")
    @WithMockUser
    void updateStopStats_success() throws Exception {
        StopStatsUpdateRequest request = new StopStatsUpdateRequest(42);
        StopResponse response = StopResponse.builder().id(1L).count(42).build();
        given(stopService.updateStopStats(1L, request)).willReturn(response);

        mockMvc.perform(patch("/stops/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(42));
    }

    @Test
    @DisplayName("Удаление остановки (позитивный) – 204")
    @WithMockUser(roles = "ADMIN")
    void deleteStop_success() throws Exception {
        doNothing().when(stopService).deleteStop(1L);
        mockMvc.perform(delete("/stops/1"))
                .andExpect(status().isOk());
    }
}
