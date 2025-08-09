package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;
import ru.slivkiai.flowdetect.service.StopHistoryService;

@RestController
@RequestMapping("/stop/history")
@RequiredArgsConstructor
@Tag(name = "Stop History", description = "API for stop history records")
public class StopHistoryController {

    private final StopHistoryService stopHistoryService;

    @PostMapping
    @Operation(summary = "Create history record")
    @ApiResponse(responseCode = "201", description = "History record created successfully")
    public StopHistoryResponse createHistoryRecord(
            @RequestBody StopHistoryRequest request) {
        return stopHistoryService.createHistoryRecord(request);
    }
}