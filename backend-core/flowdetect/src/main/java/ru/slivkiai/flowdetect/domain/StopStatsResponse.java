package ru.slivkiai.flowdetect.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
 
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class StopStatsResponse {
    private PeriodStats today;
    private PeriodStats yesterday;
    private PeriodStats week;
    private PeriodStats month;
 
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PeriodStats {
        private double avgLoad;
        private int peakLoad;
        private int minLoad;
        private double avgCount;
        private int peakCount;
        private double avgVelocity;
        private int recordCount; // сколько записей в периоде
    }
}
