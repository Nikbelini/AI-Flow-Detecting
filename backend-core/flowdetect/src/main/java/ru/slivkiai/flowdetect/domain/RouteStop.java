package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteStop {
    private Long stopId;
    private String address;
    private Integer orderInRoute;
    private String direction;
    private Integer travelTimeToNext;
    private BigDecimal lat;
    private BigDecimal lng;
    private Integer count;
    private Integer velocity;
    private Integer load;
}
