package ru.slivkiai.flowdetect.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PredictionRequestDto {
    
    private Integer cityId;
    private Integer horizon;
}
