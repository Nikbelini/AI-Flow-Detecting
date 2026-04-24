package ru.slivkiai.flowdetect.load;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.domain.Route;
import ru.slivkiai.flowdetect.domain.RouteCreateRequest;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.RouteEntity;
import ru.slivkiai.flowdetect.domain.entity.TransportType;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.RouteRepository;
import ru.slivkiai.flowdetect.repository.RouteStopRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;
import ru.slivkiai.flowdetect.service.RouteService;

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
public class RouteServiceLoadTest {

    @Mock private RouteRepository routeRepository;
    @Mock private RouteStopRepository routeStopRepository;
    @Mock private CityRepository cityRepository;
    @Mock private StopRepository stopRepository;

    @InjectMocks
    private RouteService routeService;

    @Test
    public void concurrentGetAllRoutes() throws InterruptedException {
        // Мок: один маршрут
        RouteEntity route = RouteEntity.builder()
                .id(1L)
                .number("1")
                .transportType(TransportType.BUS)
                .isActive(true)
                .city(new CityEntity())
                .build();
        when(routeRepository.findAll()).thenReturn(List.of(route));
        when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L)).thenReturn(List.of());

        int threads = 40;
        int iterationsPerThread = 150;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        List<Route> routes = routeService.getAllRoutes();
                        assertThat(routes).hasSize(1);
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
        System.out.println("Total getAllRoutes calls: " + successCount.get());
    }

    @Test
    public void concurrentGetRouteById() throws InterruptedException {
        RouteEntity route = RouteEntity.builder()
                .id(1L)
                .number("1")
                .transportType(TransportType.BUS)
                .isActive(true)
                .city(new CityEntity())
                .build();
        when(routeRepository.findById(1L)).thenReturn(Optional.of(route));
        when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L)).thenReturn(List.of());

        int threads = 50;
        int iterationsPerThread = 200;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        Route routeDto = routeService.getRouteById(1L);
                        assertThat(routeDto.getId()).isEqualTo(1L);
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
        System.out.println("Total getRouteById calls: " + successCount.get());
    }
}
