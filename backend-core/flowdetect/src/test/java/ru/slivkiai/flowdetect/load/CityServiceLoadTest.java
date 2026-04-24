package ru.slivkiai.flowdetect.load;


import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.service.CityServiceImpl;

import java.math.BigDecimal;
import java.util.List;
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
public class CityServiceLoadTest {

    @Mock
    private CityRepository cityRepository;

    @InjectMocks
    private CityServiceImpl cityService;

    @Test
    public void concurrentGetAllCities() throws InterruptedException {
        // Мок: возвращаем список городов
        CityEntity city = new CityEntity();
        city.setId(1L);
        city.setName("Москва");
        city.setLat(BigDecimal.valueOf(55.75));
        city.setLng(BigDecimal.valueOf(37.62));
        when(cityRepository.findAll()).thenReturn(List.of(city));

        int threads = 50;
        int iterationsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        List<CityResponse> cities = cityService.getAll();
                        assertThat(cities).hasSize(1);
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
        System.out.println("Total getAll calls: " + successCount.get());
    }

    @Test
    public void concurrentCreateCity() throws InterruptedException {
        CityRequest request = new CityRequest("Новгород", 58.52, 31.27);
        CityEntity savedCity = new CityEntity();
        savedCity.setId(10L);
        savedCity.setName("Новгород");
        savedCity.setLat(BigDecimal.valueOf(58.52));
        savedCity.setLng(BigDecimal.valueOf(31.27));

        when(cityRepository.save(any(CityEntity.class))).thenReturn(savedCity);

        int threads = 20;
        int iterationsPerThread = 50;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        CityResponse response = cityService.createCity(request);
                        assertThat(response.getId()).isEqualTo(10L);
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
        System.out.println("Total createCity calls: " + successCount.get());
    }
}