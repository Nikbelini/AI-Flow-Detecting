package ru.slivkiai.flowdetect.client;

import java.util.List;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import ru.slivkiai.flowdetect.dto.PredictionRequestDto;
import ru.slivkiai.flowdetect.dto.PredictionResponseDto;
import ru.slivkiai.flowdetect.dto.RoutePlanRequestDto;
import ru.slivkiai.flowdetect.dto.RoutePlanResponseDto;
import ru.slivkiai.flowdetect.dto.TrainingJobStatus;
import ru.slivkiai.flowdetect.dto.TrainingRequest;
import ru.slivkiai.flowdetect.dto.TrainingResponse;

@FeignClient(name = "flow-prediction-ml", url = "http://localhost:8083")
public interface FlowPredictionClient {
    
    @PostMapping("/ml/forecast")
    List<PredictionResponseDto> predict(@RequestBody PredictionRequestDto request);

    @PostMapping("/ml/train")
    TrainingResponse train(@RequestBody TrainingRequest request);

    @GetMapping("/ml/train/status/{jobId}")
    TrainingJobStatus getTrainingStatus(@PathVariable("jobId") String jobId);

    @GetMapping("/passenger-flow/predict/all")
    PredictionResponseDto predictAll(@RequestParam("city_id") Integer cityId,
        @RequestParam(value = "dt", required = false) String dt,
        @RequestParam(value = "neighbors_limit", defaultValue = "15") Integer neighborsLimit
    );

    @PostMapping(value = "/routes/build", consumes = "application/json", produces = "application/json")
    RoutePlanResponseDto buildOptimalRoute(@RequestBody RoutePlanRequestDto request);

}
