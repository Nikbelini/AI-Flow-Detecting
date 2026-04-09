package ru.slivkiai.flowdetect.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoutePlanResponseDto {
    
    @JsonProperty("status")
    private String status;
    
    @JsonProperty("mode")
    private String mode;
    
    @JsonProperty("total_cost_minutes")
    private Double totalCostMinutes;
    
    @JsonProperty("stops")
    private List<Long> stops;
    
    @JsonProperty("routes")
    private List<Long> routes;
    
    @JsonProperty("segments")
    private List<RouteSegmentDto> segments;
    
    @JsonProperty("error")
    private String error;
}