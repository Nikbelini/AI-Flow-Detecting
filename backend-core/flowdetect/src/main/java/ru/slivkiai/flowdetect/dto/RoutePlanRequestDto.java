package ru.slivkiai.flowdetect.dto;

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

    private String scheduledFor;
    
    public enum RouteMode {
        FASTEST, LESS_CROWDED, MIN_TRANSFERS
    }
}
