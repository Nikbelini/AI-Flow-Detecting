package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;

@AllArgsConstructor
@RequiredArgsConstructor
@Data
public class StopHistoryResponse {
    private Long id;
    @JsonProperty("cityId")
    private Long cityId;
    private StopResponse stop;
    private Integer count;
    private Integer velocity;
    private Integer load;
    private LocalDateTime datetime;
}
