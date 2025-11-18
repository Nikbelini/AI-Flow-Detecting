package ru.slivkiai.flowdetect.domain.external;

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
public class MlForecastResponse {
    private List<Map<String, Object>> predictions;
    private Map<String, Object> metrics;
    private String plotHtml;
    private String timestamp;
}
