package ru.slivkiai.flowdetect.controller;
 
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopStatsResponse;
import ru.slivkiai.flowdetect.service.StopStatsService;
 
@RestController
@RequiredArgsConstructor
public class StopStatsControllerImpl implements StopStatsController {
 
    private final StopStatsService stopStatsService;
 
    @Override
    public ResponseEntity<StopStatsResponse> getStats(@PathVariable String address) {
        return ResponseEntity.ok(stopStatsService.getStatsByAddress(address));
    }
}