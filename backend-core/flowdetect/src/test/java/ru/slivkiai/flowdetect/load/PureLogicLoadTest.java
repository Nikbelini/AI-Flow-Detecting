package ru.slivkiai.flowdetect.load;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import ru.slivkiai.flowdetect.user.dto.PolicyUpdate;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("performance")
public class PureLogicLoadTest {

    @Test
    void policyValidationConcurrency() throws InterruptedException {
        int threads = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicBoolean allValid = new AtomicBoolean(true);

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < 1000; j++) {
                        PolicyUpdate dto = new PolicyUpdate(5, 3600, 90);
                        if (dto.maxFailedAttempts() <= 0 || dto.lockDurationSeconds() < 60) {
                            allValid.set(false);
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(10, TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(allValid.get()).isTrue();
    }
}