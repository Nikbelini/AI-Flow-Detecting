package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import lombok.RequiredArgsConstructor;
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
import ru.slivkiai.flowdetect.service.StopService;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/stops")
public class StopController {
    private final StopService stopService;

    @Operation(summary = "Get all stops for map")
    @GetMapping
    public Map<String, List<StopResponse>> getStops() {
        return Map.of("stops", stopService.getAllStops());
    }

    @Operation(summary = "Get all stops for python")
    @GetMapping("/url")
    public Map<String, List<StopResponseUrl>> getStopsUrl() {
        return Map.of("stops", stopService.getAllStopsUrl());
    }

    @Operation(summary = "Get all stops for city")
    @GetMapping("/{cityId}")
    public Map<String, List<StopResponse>> getStopsUrl(@PathVariable long cityId) {
        return Map.of("stops", stopService.getAllStopsByCityId(cityId));
    }

    @PostMapping
    @Operation(summary = "Create new stop")
    @ApiResponse(responseCode = "201", description = "Stop created successfully")
    public StopResponse createStop(@RequestBody StopRequest request) {
        return stopService.createStop(request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete stop by ID")
    @ApiResponse(responseCode = "204", description = "Stop deleted successfully")
    public void deleteStop(@PathVariable Long id) {
        stopService.deleteStop(id);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Update stop statistics")
    @ApiResponse(responseCode = "200", description = "Statistics updated successfully")
    public StopResponse updateStopStats(
            @PathVariable Long id,
            @RequestBody StopStatsUpdateRequest request) {
        return stopService.updateStopStats(id, request);
    }
}
