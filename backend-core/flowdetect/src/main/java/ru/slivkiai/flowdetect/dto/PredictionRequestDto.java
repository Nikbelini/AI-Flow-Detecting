package ru.slivkiai.flowdetect.dto;

import java.util.List;

import lombok.Data;

@Data
public class PredictionRequestDto {
    
    private Long cityId;
    
    private List<StopContextDto> knownStops;
    private List<StopContextDto> unknownStops;
}
