package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;

import java.util.List;

@RestController
@RequestMapping("/cities")
public interface CityController {
    @PostMapping
    @Operation(summary = "Create new city")
    @ApiResponse(responseCode = "201", description = "City created successfully")
    CityResponse createCity(@RequestBody CityRequest request);

    @GetMapping
    @Operation(summary = "Get all cities")
    List<CityResponse> getAllCities();
}
