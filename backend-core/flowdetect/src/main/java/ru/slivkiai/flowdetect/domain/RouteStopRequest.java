package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteStopRequest {
    @NotNull(message = "ID остановки обязателен")
    private Long stopId;

    @NotNull(message = "Порядок остановки обязателен")
    private Integer order;

    private String direction;
    private Integer travelTimeToNext;
}
