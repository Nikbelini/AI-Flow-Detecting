package ru.slivkiai.flowdetect.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@AllArgsConstructor
@RequiredArgsConstructor
@Data
public class StopStatsUpdateRequest {
    private Integer count;
}
