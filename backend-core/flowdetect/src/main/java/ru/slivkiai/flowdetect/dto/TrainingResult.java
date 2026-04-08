package ru.slivkiai.flowdetect.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import java.util.Map;

@Data
@AllArgsConstructor
public class TrainingResult {
    private boolean success;
    private Map<String, Object> result;  // или отдельный DTO
    private String errorMessage;
    
    public static TrainingResult success(Map<String, Object> result) {
        return new TrainingResult(true, result, null);
    }
    
    public static TrainingResult failed(String error) {
        return new TrainingResult(false, null, error);
    }
}
