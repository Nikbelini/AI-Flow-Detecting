package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;
import ru.slivkiai.flowdetect.service.StopHistoryService;

@RestController
@RequiredArgsConstructor
public class StopHistoryControllerImpl implements StopHistoryController {

    private final StopHistoryService stopHistoryServiceImpl;

    @Override
    public StopHistoryResponse createHistoryRecord(
            StopHistoryRequest request) {
        return stopHistoryServiceImpl.createHistoryRecord(request);
    }
}