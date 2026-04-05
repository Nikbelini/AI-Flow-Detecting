package ru.slivkiai.flowdetect.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionResponseDto {
    
    @JsonProperty("address")
    private String address;
    
    @JsonProperty("lat")
    private Double lat;
    
    @JsonProperty("lng")
    private Double lng;
    
    @JsonProperty("has_camera")
    private Boolean hasCamera;
    
    @JsonProperty("predicted_count")
    private Integer predictedCount;
    
    @JsonProperty("predicted_velocity")
    private Integer predictedVelocity;
    
    @JsonProperty("predicted_load")
    private Integer predictedLoad;
    
    @JsonProperty("forecast_horizon")
    private Integer forecastHorizon;
    
    @JsonProperty("full_forecast")
    private List<Integer> fullForecast;
}