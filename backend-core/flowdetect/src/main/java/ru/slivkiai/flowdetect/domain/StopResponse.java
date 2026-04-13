package ru.slivkiai.flowdetect.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
public class StopResponse {
    private Long id;
    private String url;
    private String address;

    private Integer count;
    private Integer velocity;
    private Integer load;
    private Double lat;
    private Double lng;

    private boolean hasCamera;
    // private boolean predicted;    
    
    private Integer algorithmicCount;
    private Integer algorithmicVelocity;
    private Integer algorithmicLoad;

    private boolean isMlFallback;
    private boolean hasAlgorithmicData;
}
