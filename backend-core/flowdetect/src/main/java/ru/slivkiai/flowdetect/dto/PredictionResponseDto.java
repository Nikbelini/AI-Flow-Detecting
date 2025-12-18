package ru.slivkiai.flowdetect.dto;

import lombok.Data;

@Data
public class PredictionResponseDto {
    
    private Long stopId;
    private Integer predictedCount;
}
