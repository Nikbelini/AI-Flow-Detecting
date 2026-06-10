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

    @JsonProperty("routing_score")
    private Double routingScore;
    
    @JsonProperty("stops")
    private List<Long> stops;
    
    @JsonProperty("routes")
    private List<Long> routes;
    
    @JsonProperty("segments")
    private List<RouteSegmentDto> segments;

    @JsonProperty("alternatives")
    private List<RouteAlternativeDto> alternatives;

    @JsonProperty("is_scheduled")
    private Boolean isScheduled;

    @JsonProperty("scheduled_message")
    private String scheduledMessage;

    @JsonProperty("effective_datetime")
    private String effectiveDatetime;
    
    @JsonProperty("error")
    private String error;
}