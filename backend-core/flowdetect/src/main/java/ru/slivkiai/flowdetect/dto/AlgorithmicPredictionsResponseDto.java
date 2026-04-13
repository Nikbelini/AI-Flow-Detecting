package ru.slivkiai.flowdetect.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlgorithmicPredictionsResponseDto {
    
    private Integer cityId;
    
    private String datetime;

    private Integer stopsTotal;

    private List<PredictionResponseDto> results;
}
