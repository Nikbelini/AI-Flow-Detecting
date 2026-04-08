package ru.slivkiai.flowdetect.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TrainingJobStatus {
    private String jobId;
    private Integer cityId;
    private String status;        // queued | running | success | failed
    private Double progress;      // 0.0 .. 1.0
    private String createdAt;
    private String updatedAt;
    private Map<String, Object> result;  // только если success/failed
    private String error; 
}
