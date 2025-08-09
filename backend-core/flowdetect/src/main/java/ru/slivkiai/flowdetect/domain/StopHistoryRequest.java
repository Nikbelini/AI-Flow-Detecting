package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@AllArgsConstructor
@RequiredArgsConstructor
@Data
public class StopHistoryRequest {
    private Integer count;
    private Integer velocity;
    private Integer load;
    @JsonProperty("cityId")
    private Long cityId;
    private String address;
}
