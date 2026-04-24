package ru.slivkiai.flowdetect.load;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.service.ChartService;

import java.io.IOException;
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
public class ChartServiceLoadTest {

    @Mock
    private StopHistoryRepository stopHistoryRepository;

    @InjectMocks
    private ChartService chartService;

    @Test
    public void concurrentGenerateLoadChart() throws InterruptedException, IOException {
        // Мок: возвращаем пустую историю (график всё равно сгенерируется)
        when(stopHistoryRepository.findByAddressAndDatetimeBetween(any(), any(), any()))
                .thenReturn(List.of());

        int threads = 30;
        int iterationsPerThread = 50;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        byte[] chart = chartService.generateLoadChartForLast12Hours("ул. Ленина, 1");
                        assertThat(chart).isNotEmpty();
                        successCount.incrementAndGet();
                    }
                } catch (IOException e) {
                    throw new RuntimeException(e);
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(30, TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(successCount.get()).isEqualTo(threads * iterationsPerThread);
        System.out.println("Total charts generated: " + successCount.get());
    }
}
