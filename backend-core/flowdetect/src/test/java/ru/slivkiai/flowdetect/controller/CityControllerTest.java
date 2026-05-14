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
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;
import ru.slivkiai.flowdetect.service.CityService;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CityControllerImpl.class)
@ExtendWith(MockitoExtension.class)
public class CityControllerTest {
     @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CityService cityService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    @DisplayName("Создание города (позитивный) — 200, поля в ответе")
    @WithMockUser(roles = "ADMIN")
    void createCity_success() throws Exception {
        CityRequest request = new CityRequest("Москва", 55.7558, 37.6176);
        CityResponse response = new CityResponse(1L, "Москва", 55.7558, 37.6176);
        given(cityService.createCity(any(CityRequest.class))).willReturn(response);

        mockMvc.perform(post("/cities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.name").value("Москва"))
                .andExpect(jsonPath("$.lat").value(55.7558))
                .andExpect(jsonPath("$.lng").value(37.6176));
    }

    @Test
    @DisplayName("Создание города с невалидными координатами (негативный) — 400")
    @WithMockUser(roles = "ADMIN")
    void createCity_invalidCoordinates() throws Exception {
        String invalidJson = "{\"name\":\"Город\",\"lat\":100,\"lng\":200}";
        mockMvc.perform(post("/cities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Получение всех городов (позитивный) — 200, список")
    @WithMockUser
    void getAllCities_success() throws Exception {
        CityResponse city1 = new CityResponse(1L, "Москва", 55.7558, 37.6176);
        CityResponse city2 = new CityResponse(2L, "СПб", 59.9343, 30.3351);
        given(cityService.getAll()).willReturn(List.of(city1, city2));

        mockMvc.perform(get("/cities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Москва"))
                .andExpect(jsonPath("$[1].name").value("СПб"));
    }

    @Test
    @DisplayName("Получение всех городов при пустой БД (позитивный) — 200, пустой список")
    @WithMockUser
    void getAllCities_empty() throws Exception {
        given(cityService.getAll()).willReturn(List.of());
        mockMvc.perform(get("/cities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
