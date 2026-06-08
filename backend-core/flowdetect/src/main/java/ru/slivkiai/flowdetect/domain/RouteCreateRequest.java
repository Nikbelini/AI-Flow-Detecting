package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.slivkiai.flowdetect.domain.entity.TransportType;

import java.util.List;

import jakarta.validation.constraints.NotNull;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteCreateRequest {
    @NotNull(message = "Номер маршрута не может быть пустым")
    private String number;

    private String name;

    @NotNull(message = "Тип транспорта обязателен")
    private TransportType transportType;

    @NotNull(message = "ID города обязателен")
    private Long cityId;

    private String directionAName;
    private String directionBName;
    private Integer intervalMinutes;
    private String operatingHours;

    @NotNull(message = "Список остановок не может быть null")
    private List<@NotNull RouteStopRequest> stops;
}
