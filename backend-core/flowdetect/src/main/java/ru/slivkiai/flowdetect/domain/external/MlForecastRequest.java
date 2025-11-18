package ru.slivkiai.flowdetect.domain.external;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MlForecastRequest {
    private List<Map<String, Object>> historicalData;
    private Integer forecastHorizon;
    private Boolean includePlots;
}
