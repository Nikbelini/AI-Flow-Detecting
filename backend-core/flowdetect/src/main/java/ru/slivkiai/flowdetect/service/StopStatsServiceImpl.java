package ru.slivkiai.flowdetect.service;
 
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.domain.StopStatsResponse;
import ru.slivkiai.flowdetect.domain.StopStatsResponse.PeriodStats;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
 
import java.time.LocalDateTime;
import java.util.List;
 
@Service
@RequiredArgsConstructor
@Slf4j
public class StopStatsServiceImpl implements StopStatsService {
 
    private final StopHistoryRepository stopHistoryRepository;
 
    @Override
    public StopStatsResponse getStatsByAddress(String address) {
        log.info("📊 Fetching stats for address: {}", address);
 
        LocalDateTime now = LocalDateTime.now();
 
        List<StopHistoryEntity> todayRecords = stopHistoryRepository
                .findByAddressAndDatetimeBetween(address, now.toLocalDate().atStartOfDay(), now);
 
        List<StopHistoryEntity> yesterdayRecords = stopHistoryRepository
                .findByAddressAndDatetimeBetween(address,
                        now.toLocalDate().minusDays(1).atStartOfDay(),
                        now.toLocalDate().atStartOfDay());
 
        List<StopHistoryEntity> weekRecords = stopHistoryRepository
                .findByAddressAndDatetimeBetween(address, now.minusDays(7), now);
 
        List<StopHistoryEntity> monthRecords = stopHistoryRepository
                .findByAddressAndDatetimeBetween(address, now.minusDays(30), now);
 
        return StopStatsResponse.builder()
                .today(calcStats(todayRecords))
                .yesterday(calcStats(yesterdayRecords))
                .week(calcStats(weekRecords))
                .month(calcStats(monthRecords))
                .build();
    }
 
    private PeriodStats calcStats(List<StopHistoryEntity> records) {
        if (records == null || records.isEmpty()) {
            return PeriodStats.builder()
                    .avgLoad(0).peakLoad(0).minLoad(0)
                    .avgCount(0).peakCount(0).avgVelocity(0)
                    .recordCount(0)
                    .build();
        }
 
        double avgLoad = records.stream()
                .mapToInt(StopHistoryEntity::getLoad)
                .average().orElse(0);
 
        int peakLoad = records.stream()
                .mapToInt(StopHistoryEntity::getLoad)
                .max().orElse(0);
 
        int minLoad = records.stream()
                .mapToInt(StopHistoryEntity::getLoad)
                .min().orElse(0);
 
        double avgCount = records.stream()
                .mapToInt(StopHistoryEntity::getCount)
                .average().orElse(0);
 
        int peakCount = records.stream()
                .mapToInt(StopHistoryEntity::getCount)
                .max().orElse(0);
 
        double avgVelocity = records.stream()
                .mapToInt(StopHistoryEntity::getVelocity)
                .average().orElse(0);
 
        return PeriodStats.builder()
                .avgLoad(Math.round(avgLoad * 10.0) / 10.0)
                .peakLoad(peakLoad)
                .minLoad(minLoad)
                .avgCount((int) Math.round(avgCount))
                .peakCount(peakCount)
                .avgVelocity(Math.round(avgVelocity * 10.0) / 10.0)
                .recordCount(records.size())
                .build();
    }
}