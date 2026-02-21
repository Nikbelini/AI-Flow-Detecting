package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@AllArgsConstructor
@RequiredArgsConstructor
@Data
public class StopRequest {
    private String url;
    private String address;
    private Integer count;
    private Integer velocity;
    private Integer load;
    private Double lat;
    private Double lng;
    @JsonProperty("cityId")
    private Long cityId;
}
