package ru.slivkiai.flowdetect.service;

import ru.slivkiai.flowdetect.domain.StopStatsResponse;
 
public interface StopStatsService {
    StopStatsResponse getStatsByAddress(String address);
}
