package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.client.FlowPredictionClient;
import ru.slivkiai.flowdetect.dto.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrainingService {
    
    private final FlowPredictionClient flowPredictionClient;

    public TrainingResult trainAndWait(Integer cityId, boolean forceRetrain, long timeoutMinutes) {
        
        // Запускаем обучение
        TrainingRequest request = TrainingRequest.builder()
            .cityId(cityId)
            .forceRetrain(forceRetrain)
            .build();

        TrainingResponse started = flowPredictionClient.train(request);
        String jobId = started.getJobId();
        
        log.info("Training started: jobId={}, cityId={}", jobId, cityId);
        
        // Поллинг статуса
        long deadline = System.currentTimeMillis() + timeoutMinutes * 60_000L;
        int pollCount = 0;
        
        while (System.currentTimeMillis() < deadline) {
            TrainingJobStatus status = flowPredictionClient.getTrainingStatus(jobId);
            pollCount++;
            
            switch (status.getStatus().toLowerCase()) {
                case "success":
                    log.info("Training succeeded: jobId={}, progress={}", jobId, status.getProgress());
                    return TrainingResult.success(status.getResult());
                    
                case "failed":
                    log.error("Training failed: jobId={}, error={}", jobId, status.getError());
                    return TrainingResult.failed(status.getError());
                    
                case "running":
                    // Логируем прогресс каждые 10 опросов (~50 сек)
                    if (pollCount % 10 == 0 && status.getProgress() != null) {
                        log.info("Training in progress: {}%", (int)(status.getProgress() * 100));
                    }
                    break;
                    
                case "queued":
                default:
                    // Ждём
                    break;
            }
            
            try {
                Thread.sleep(300000); // опрос каждые 300 секунд
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                log.warn("Polling interrupted for jobId={}", jobId);
                return TrainingResult.failed("Polling interrupted");
            }
        }
        
        log.error("Training timeout: jobId={}", jobId);
        return TrainingResult.failed("Training timeout after " + timeoutMinutes + " minutes");
    }
}
