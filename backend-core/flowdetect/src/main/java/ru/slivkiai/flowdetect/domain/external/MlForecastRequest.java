package ru.slivkiai.flowdetect.domain.external;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MlForecastRequest {
    @JsonProperty("historical_data")
    private List<Map<String, Object>> historicalData;
    @JsonProperty("forecast_horizon")
    private Integer forecastHorizon;
    @JsonProperty("include_plots")
    private Boolean includePlots;
}
