package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import jakarta.persistence.EntityNotFoundException;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class StopHistoryServiceTest {
    @Mock private StopHistoryRepository stopHistoryRepository;
    @Mock private CityRepository cityRepository;
    @Mock private StopRepository stopRepository;
    @Mock private WeatherService weatherService;

    @InjectMocks
    private StopHistoryServiceImpl stopHistoryService;

    @Test
    @DisplayName("Создание записи истории – позитивный")
    void createHistoryRecord_success() {
        CityEntity city = CityEntity.builder().id(1L).name("Москва").build();
        StopEntity stop = StopEntity.builder().id(100L).address("Тест").build();
        StopHistoryRequest request = StopHistoryRequest.builder()
                .cityId(1L).stopId(100L).lat(BigDecimal.valueOf(55)).lng(BigDecimal.valueOf(37))
                .count(10).velocity(5).load(3).address("Тест").build();

        given(cityRepository.findById(1L)).willReturn(Optional.of(city));
        given(stopRepository.findById(100L)).willReturn(Optional.of(stop));
        given(stopHistoryRepository.save(any(StopHistoryEntity.class))).willAnswer(inv -> inv.getArgument(0));

        StopHistoryResponse response = stopHistoryService.createHistoryRecord(request);

        assertThat(response.getCount()).isEqualTo(10);
        verify(weatherService).fetchAndSaveCurrentWeather(city);
    }

    @Test
    @DisplayName("Создание записи – город не найден (негативный)")
    void createHistoryRecord_cityNotFound() {
        StopHistoryRequest request = StopHistoryRequest.builder().cityId(99L).build();
        given(cityRepository.findById(99L)).willReturn(Optional.empty());
        assertThatThrownBy(() -> stopHistoryService.createHistoryRecord(request))
                .isInstanceOf(EntityNotFoundException.class);
        verify(weatherService, never()).fetchAndSaveCurrentWeather(any());
    }
}
