package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopResponseUrl;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/stops")
public interface StopController {
    @Operation(summary = "Get all stops for map")
    @GetMapping
    Map<String, List<StopResponse>> getStops();

    @Operation(summary = "Get all stops for python")
    @GetMapping("/url")
    Map<String, List<StopResponseUrl>> getStopsUrl();

    @Operation(summary = "Get all stops for city")
    @GetMapping("/{cityId}")
    Map<String, List<StopResponse>> getStopsByCityId(@PathVariable Long cityId);

    @PostMapping
    @Operation(summary = "Create new stop")
    @ApiResponse(responseCode = "201", description = "Stop created successfully")
    StopResponse createStop(@RequestBody StopRequest request);

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete stop by ID")
    @ApiResponse(responseCode = "204", description = "Stop deleted successfully")
    void deleteStop(@PathVariable Long id);

    @PatchMapping("/{id}")
    @Operation(summary = "Update stop statistics")
    @ApiResponse(responseCode = "200", description = "Statistics updated successfully")
    StopResponse updateStopStats(
            @PathVariable Long id,
            @RequestBody StopStatsUpdateRequest request);
}
