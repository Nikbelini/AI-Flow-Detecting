package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.slivkiai.flowdetect.domain.entity.TransportType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteSearchRequest {
    private Long cityId;
    private TransportType transportType;
    private Boolean isActive;
    private String search;
}
