package ru.slivkiai.flowdetect.dto;

import java.util.List;

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
    private Double totalCostMinutes;

    private List<Long> stops;
    private List<Long> routes;
    private List<RouteSegmentDto> segments;
}
