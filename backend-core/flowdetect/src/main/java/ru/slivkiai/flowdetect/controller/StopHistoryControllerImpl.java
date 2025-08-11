package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;
import ru.slivkiai.flowdetect.service.ChartService;
import ru.slivkiai.flowdetect.service.StopHistoryService;

import java.io.IOException;

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
    public ResponseEntity<byte[]> getLoadChart(@PathVariable String address) throws IOException {
        byte[] chartImage = chartService.generateLoadChartForLast12Hours(address);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.IMAGE_PNG);
        headers.setContentLength(chartImage.length);

        return new ResponseEntity<>(chartImage, headers, HttpStatus.OK);
    }
}