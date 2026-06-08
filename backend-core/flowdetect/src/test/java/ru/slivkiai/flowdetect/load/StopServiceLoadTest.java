package ru.slivkiai.flowdetect.load;


import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.client.FlowPredictionClient;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;
import ru.slivkiai.flowdetect.service.StopHistoryService;
import ru.slivkiai.flowdetect.service.StopServiceImpl;
import ru.slivkiai.flowdetect.service.WeatherService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("performance")
public class StopServiceLoadTest {

    @Mock private StopRepository stopRepository;
    @Mock private CityRepository cityRepository;
    @Mock private StopHistoryRepository stopHistoryRepository;
    @Mock private StopHistoryService stopHistoryService;
    @Mock private FlowPredictionClient flowPredictionClient;
    @Mock private WeatherService weatherService;

    @InjectMocks
    private StopServiceImpl stopService;

    @Test
    public void concurrentGetAllStops() throws InterruptedException {
        StopEntity stop = StopEntity.builder()
                .id(1L)
                .address("ул. Ленина")
                .count(10)
                .velocity(5)
                .load(3)
                .lat(BigDecimal.valueOf(55.75))
                .lng(BigDecimal.valueOf(37.62))
                .url("http://camera.com")
                .city(new CityEntity())
                .build();

        when(stopRepository.findAll()).thenReturn(List.of(stop));

        int threads = 30;
        int iterationsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        List<StopResponse> stops = stopService.getAllStops();
                        assertThat(stops).hasSize(1);
                        successCount.incrementAndGet();
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(30, TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(successCount.get()).isEqualTo(threads * iterationsPerThread);
        System.out.println("Total getAllStops calls: " + successCount.get());
    }

    @Test
    public void concurrentUpdateStopStats() throws InterruptedException {
        StopEntity stop = StopEntity.builder()
                .id(1L)
                .address("ул. Ленина")
                .count(10)
                .velocity(5)
                .load(3)
                .lat(BigDecimal.valueOf(55.75))
                .lng(BigDecimal.valueOf(37.62))
                .city(new CityEntity())
                .build();

        when(stopRepository.findById(1L)).thenReturn(Optional.of(stop));
        when(stopRepository.save(any(StopEntity.class))).thenReturn(stop);

        // Мокаем историю для расчёта velocity/load
        StopHistoryEntity oldHistory = StopHistoryEntity.builder()
                .id(100L)
                .datetime(LocalDateTime.now().minusMinutes(5))
                .count(5)
                .build();
        StopHistoryEntity newHistory = StopHistoryEntity.builder()
                .id(101L)
                .datetime(LocalDateTime.now())
                .count(10)
                .build();
        when(stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc(any()))
                .thenReturn(List.of(newHistory, oldHistory));

        // Мокаем создание записи истории через сервис
        when(stopHistoryService.createHistoryRecord(any())).thenReturn(null);

        StopStatsUpdateRequest request = new StopStatsUpdateRequest(20); // новый count = 20

        int threads = 20;
        int iterationsPerThread = 50;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        StopResponse response = stopService.updateStopStats(1L, request);
                        assertThat(response).isNotNull();
                        successCount.incrementAndGet();
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(30, TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(successCount.get()).isEqualTo(threads * iterationsPerThread);
        System.out.println("Total updateStopStats calls: " + successCount.get());
    }
}