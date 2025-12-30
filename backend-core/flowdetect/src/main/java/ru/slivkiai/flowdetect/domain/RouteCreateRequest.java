package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.slivkiai.flowdetect.domain.entity.TransportType;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteCreateRequest {
    private String number;
    private String name;
    private TransportType transportType;
    private Long cityId;
    private String directionAName;
    private String directionBName;
    private Integer intervalMinutes;
    private String operatingHours;
    private List<RouteStopRequest> stops;
}
