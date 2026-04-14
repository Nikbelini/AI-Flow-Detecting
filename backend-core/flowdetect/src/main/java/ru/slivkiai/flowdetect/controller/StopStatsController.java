package ru.slivkiai.flowdetect.controller;
 
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopStatsResponse;
 
@RestController
@RequestMapping("/stops/history")
@Tag(name = "Stop Stats", description = "Aggregated statistics for stops")
public interface StopStatsController {
 
    @GetMapping("/{address}/stats")
    @Operation(summary = "Get aggregated stats for today / yesterday / week / month")
    ResponseEntity<StopStatsResponse> getStats(@PathVariable String address);
}