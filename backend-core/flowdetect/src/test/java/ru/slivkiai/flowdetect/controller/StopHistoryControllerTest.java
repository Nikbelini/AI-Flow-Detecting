package ru.slivkiai.flowdetect.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import ru.slivkiai.flowdetect.auth.jwt.JwtService;
import ru.slivkiai.flowdetect.service.ChartService;
import ru.slivkiai.flowdetect.service.StopHistoryService;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StopHistoryControllerImpl.class)
@ExtendWith(MockitoExtension.class)
public class StopHistoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StopHistoryService stopHistoryService;

    @MockBean
    private ChartService chartService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    @DisplayName("Генерация графика – позитивный: возвращает PNG")
    void getLoadChart_success() throws Exception {
        byte[] fakePng = {1, 2, 3, 4};
        given(chartService.generateLoadChartForLast12Hours(anyString())).willReturn(fakePng);

        mockMvc.perform(get("/stops/history/Тест/chart"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(fakePng));
    }
}