package ru.slivkiai.flowdetect.domain.external;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteOptimizationResponse {
    private Boolean success;
    private Long cityId;
    private Map<String, Object> currentAnalysis;
    private List<String> recommendations;
    private List<String> optimizationGoals;
    private LocalDateTime timestamp;
}
