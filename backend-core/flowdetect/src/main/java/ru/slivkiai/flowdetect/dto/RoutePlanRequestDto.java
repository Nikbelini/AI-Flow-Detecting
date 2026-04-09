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
public class RoutePlanRequestDto {
    private Long cityId;      
    private String datetime;       
    private Long startStopId;     
    private Long goalStopId;      
    private RouteMode mode;           // FASTEST, LESS_CROWDED, MIN_TRANSFERS
    
    public enum RouteMode {
        FASTEST, LESS_CROWDED, MIN_TRANSFERS
    }
}
