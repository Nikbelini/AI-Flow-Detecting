package ru.slivkiai.flowdetect.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TrainingResponse {
    private String jobId;
    private Integer cityId;
    private String status;
    private String message;
}
