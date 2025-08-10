package ru.slivkiai.flowdetect.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CityRequest {
    String name;
    @JsonProperty("lat")
    Double lat;
    @JsonProperty("lng")
    Double lng;
}
