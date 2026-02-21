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
public class ScenarioEvaluationResponse {
    private Boolean success;
    private String scenarioName;
    private Map<String, Object> comparison;
    private Map<String, Object> estimatedImpact;
    private LocalDateTime timestamp;
}
