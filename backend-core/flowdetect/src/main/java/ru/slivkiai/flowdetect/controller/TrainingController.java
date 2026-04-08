package ru.slivkiai.flowdetect.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.client.FlowPredictionClient;
import ru.slivkiai.flowdetect.dto.TrainingJobStatus;
import ru.slivkiai.flowdetect.dto.TrainingRequest;
import ru.slivkiai.flowdetect.dto.TrainingResult;
import ru.slivkiai.flowdetect.service.TrainingService;

@RestController
@RequestMapping("/api/training")
@RequiredArgsConstructor
public class TrainingController {
    
    private final TrainingService trainingService;

    private final FlowPredictionClient flowPredictionClient;
    
    @PostMapping("/start-and-wait")
    public ResponseEntity<TrainingResult> trainAndWait(
            @RequestBody TrainingRequest request,
            @RequestParam(defaultValue = "10") long timeoutMinutes) {
        
        TrainingResult result = trainingService.trainAndWait(
            request.getCityId(), 
            request.isForceRetrain(), 
            timeoutMinutes
        );
        
        return ResponseEntity.ok(result);
    }
    
    // Опционально: эндпоинт для ручного опроса (если нужно в UI)
    @GetMapping("/status/{jobId}")
    public ResponseEntity<TrainingJobStatus> getStatus(@PathVariable String jobId) {
        return ResponseEntity.ok(flowPredictionClient.getTrainingStatus(jobId));
    }
}
