package ru.slivkiai.flowdetect.domain;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@AllArgsConstructor
@RequiredArgsConstructor
@Data
@Builder
public class StopHistoryRequest {
    private Integer count;
    private Integer velocity;
    private Integer load;
    @JsonProperty("cityId")
    private Long cityId;

    @JsonProperty("stopId")
    private Long stopId;        // OSM node ID (уникальный!)
    private BigDecimal lat;     // Широта
    private BigDecimal lng;     // Долгота
    private String address;
}
