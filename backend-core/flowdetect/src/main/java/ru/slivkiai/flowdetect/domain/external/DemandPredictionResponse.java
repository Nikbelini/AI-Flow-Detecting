package ru.slivkiai.flowdetect.domain.external;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DemandPredictionResponse {
    private Boolean success;
    private Long cityId;
    private PredictionRange predictionRange;
    private Map<String, Object> predictions;
    private LocalDateTime timestamp;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PredictionRange {
        private LocalDateTime start;
        private LocalDateTime end;
    }
}
