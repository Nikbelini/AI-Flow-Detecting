package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;
import ru.slivkiai.flowdetect.service.ChartService;
import ru.slivkiai.flowdetect.service.StopHistoryService;

@RestController
@RequiredArgsConstructor
public class StopHistoryControllerImpl implements StopHistoryController {

    private final StopHistoryService stopHistoryServiceImpl;
    private final ChartService chartService;

    @Override
    public StopHistoryResponse createHistoryRecord(
            StopHistoryRequest request) {
        return stopHistoryServiceImpl.createHistoryRecord(request);
    }

    @Override
    public ResponseEntity<String> getLoadChart(
            @PathVariable String address) {
        try {
            String chartBase64 = chartService.generateLoadChartForLast12Hours(address);
            return ResponseEntity.ok(chartBase64);
        }
        catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}