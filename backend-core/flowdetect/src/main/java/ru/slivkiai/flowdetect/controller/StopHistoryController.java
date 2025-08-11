package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;

@RestController
@RequestMapping("/stops/history")
@Tag(name = "Stop History", description = "API for stop history records")
public interface StopHistoryController {
    @PostMapping
    @Operation(summary = "Create history record")
    @ApiResponse(responseCode = "201", description = "History record created successfully")
    StopHistoryResponse createHistoryRecord(
            @RequestBody StopHistoryRequest request);

    @GetMapping("/{address}/chart")
    @Operation(summary = "Get load chart for last 12 hours")
    @ApiResponse(responseCode = "200", description = "Chart generated successfully",
            content = @Content(mediaType = "text/plain"))
    ResponseEntity<String> getLoadChart(
            @PathVariable String address);
}
