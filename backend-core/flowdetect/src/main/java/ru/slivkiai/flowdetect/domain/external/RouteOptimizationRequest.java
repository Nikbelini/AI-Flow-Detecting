package ru.slivkiai.flowdetect.domain.external;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteOptimizationRequest {
    private Long cityId;
    private List<String> optimizationGoals;
    private Map<String, Object> constraints;
}
