package ru.slivkiai.flowdetect.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RouteAlternativeDto {
    
    private String label;
    private String modeUsed;

    @JsonProperty("total_cost_minutes")
    private Double totalCostMinutes;

    @JsonProperty("routing_score")
    private Double routingScore;

    private List<Long> stops;
    private List<Long> routes;
    private List<RouteSegmentDto> segments;
}
