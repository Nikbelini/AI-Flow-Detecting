package ru.slivkiai.flowdetect.client;

import java.util.List;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import ru.slivkiai.flowdetect.dto.PredictionRequestDto;
import ru.slivkiai.flowdetect.dto.PredictionResponseDto;

@FeignClient(name = "flow-prediction-ml", url = "http://localhost:8083")
public interface FlowPredictionClient {
    
    @PostMapping("/forecast")
    List<PredictionResponseDto> predict(@RequestBody PredictionRequestDto request);
}
