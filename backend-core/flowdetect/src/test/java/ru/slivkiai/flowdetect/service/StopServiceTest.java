package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import jakarta.persistence.EntityNotFoundException;
import ru.slivkiai.flowdetect.client.FlowPredictionClient;
import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.dto.PredictionResponseDto;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class StopServiceTest {
        @Mock
        private StopRepository stopRepository;
        @Mock
        private CityRepository cityRepository;
        @Mock
        private StopHistoryRepository stopHistoryRepository;
        @Mock
        private StopHistoryService stopHistoryService;
        @Mock
        private FlowPredictionClient flowPredictionClient;

        @InjectMocks
        private StopServiceImpl stopService;

        private CityEntity city;
        private StopEntity stop;

        @BeforeEach
        void setUp() {
                city = CityEntity.builder().id(1L).name("Москва").build();
                stop = StopEntity.builder()
                                .id(10L)
                                .address("ул. Ленина, 1")
                                .count(5)
                                .velocity(2)
                                .load(3)
                                .lat(BigDecimal.valueOf(55.7558))
                                .lng(BigDecimal.valueOf(37.6176))
                                .city(city)
                                .url("http://camera.com")
                                .build();
        }

        @Test
        @DisplayName("createStop – успешное создание (позитивный)")
        void createStop_success() {
                StopRequest request = new StopRequest(null, "Новая", 0, 0, 0, 55.0, 37.0, 1L);
                given(cityRepository.findById(1L)).willReturn(Optional.of(city));
                given(stopRepository.save(any(StopEntity.class))).willAnswer(inv -> inv.getArgument(0));
                given(stopHistoryService.createHistoryRecord(any())).willReturn(null);

                StopResponse response = stopService.createStop(request);
                assertThat(response.getAddress()).isEqualTo("Новая");
                verify(stopHistoryService, atLeastOnce()).createHistoryRecord(any());
        }

        @Test
        @DisplayName("createStop – город не найден (негативный)")
        void createStop_cityNotFound() {
                StopRequest request = new StopRequest(null, "Новая", 0, 0, 0, 55.0, 37.0, 99L);
                given(cityRepository.findById(99L)).willReturn(Optional.empty());
                assertThatThrownBy(() -> stopService.createStop(request))
                                .isInstanceOf(EntityNotFoundException.class);
        }

        @Test
        @DisplayName("updateStopStats – успешное обновление с пересчётом velocity/load (позитивный)")
        void updateStopStats_success() {
                StopHistoryEntity oldHistory = StopHistoryEntity.builder()
                                .datetime(LocalDateTime.now().minusMinutes(5))
                                .count(10)
                                .build();
                StopHistoryEntity newHistory = StopHistoryEntity.builder()
                                .datetime(LocalDateTime.now())
                                .count(15)
                                .build();
                given(stopRepository.findById(10L)).willReturn(Optional.of(stop));
                given(stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc("ул. Ленина, 1"))
                                .willReturn(List.of(newHistory, oldHistory));
                given(stopRepository.save(any(StopEntity.class))).willReturn(stop);
                given(stopHistoryService.createHistoryRecord(any())).willReturn(null);

                StopStatsUpdateRequest request = new StopStatsUpdateRequest(25);
                StopResponse response = stopService.updateStopStats(10L, request);

                assertThat(response.getCount()).isEqualTo(25);
                ArgumentCaptor<StopEntity> captor = ArgumentCaptor.forClass(StopEntity.class);
                verify(stopRepository).save(captor.capture());
                assertThat(captor.getValue().getVelocity()).isEqualTo(3);
        }

        @Test
        @DisplayName("updateStopStats – недостаточно записей истории (негативный): создаются новые, затем расчёт")
        void updateStopStats_insufficientHistory() {
                given(stopRepository.findById(10L)).willReturn(Optional.of(stop));

                StopHistoryEntity record1 = StopHistoryEntity.builder()
                                .datetime(LocalDateTime.now())
                                .count(0)
                                .build();
                StopHistoryEntity record2 = StopHistoryEntity.builder()
                                .datetime(LocalDateTime.now().minusMinutes(1))
                                .count(0)
                                .build();

                given(stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc("ул. Ленина, 1"))
                                .willReturn(List.of())
                                .willReturn(List.of(record1, record2));

                given(stopHistoryService.createHistoryRecord(any())).willReturn(null);
                given(stopRepository.save(any())).willReturn(stop);

                StopStatsUpdateRequest request = new StopStatsUpdateRequest(20);
                StopResponse response = stopService.updateStopStats(10L, request);

                assertThat(response.getCount()).isEqualTo(20);
                verify(stopHistoryService, times(3)).createHistoryRecord(any());
        }

        @Test
        @DisplayName("getAllStops – слепая остановка получает ML-прогноз (позитивный)")
        void getAllStops_blindStop_usesMlPrediction() {
                StopEntity blindStop = StopEntity.builder()
                                .id(20L).address("Слепая").city(city).url(null)
                                .lat(BigDecimal.ZERO).lng(BigDecimal.ZERO).build();
                given(stopRepository.findAll()).willReturn(List.of(blindStop));
                PredictionResponseDto prediction = PredictionResponseDto.builder()
                                .address("Слепая").predictedCount(100).predictedVelocity(50).predictedLoad(8).build();
                // Мокируем вызов клиента
                given(flowPredictionClient.predict(any())).willReturn(List.of(prediction));

                List<StopResponse> result = stopService.getAllStops();
                assertThat(result).hasSize(1);
                assertThat(result.get(0).getCount()).isEqualTo(100);
                assertThat(result.get(0).isMlFallback()).isTrue();
        }
}
