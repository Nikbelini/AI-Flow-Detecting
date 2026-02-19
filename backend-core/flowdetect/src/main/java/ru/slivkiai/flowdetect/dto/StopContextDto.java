package ru.slivkiai.flowdetect.dto;

import java.util.List;

import lombok.Data;

@Data
public class StopContextDto {
    
    private Long stopId;
    private double lat;
    private double lng;

    private List<Integer> flowHistory;
    private List<Double> temperatures;
    private List<Integer> eventFlags;
}
