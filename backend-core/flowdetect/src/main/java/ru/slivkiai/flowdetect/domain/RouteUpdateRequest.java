package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.slivkiai.flowdetect.domain.entity.TransportType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteUpdateRequest {
    private String number;
    private String name;
    private TransportType transportType;
    private Boolean isActive;
    private String directionAName;
    private String directionBName;
    private Integer intervalMinutes;
    private String operatingHours;
}
