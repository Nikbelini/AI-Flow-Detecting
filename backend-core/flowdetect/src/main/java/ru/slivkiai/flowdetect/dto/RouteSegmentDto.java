package ru.slivkiai.flowdetect.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RouteSegmentDto {
    
    @JsonProperty("from_stop")
    private Long fromStop;
    
    @JsonProperty("to_stop")
    private Long toStop;
    
    @JsonProperty("route_id")
    private Long routeId;
    
    @JsonProperty("dist_km")
    private Double distKm;
    
    @JsonProperty("travel_time_min")
    private Double travelTimeMin;
    
    @JsonProperty("load_from")
    private Integer loadFrom;
    
    @JsonProperty("load_to")
    private Integer loadTo;
}
