package ru.slivkiai.flowdetect.domain;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class WeatherResponseDto {
    private Integer weatherCode;
    private BigDecimal precipitation;
    private LocalDateTime datetime;
}
