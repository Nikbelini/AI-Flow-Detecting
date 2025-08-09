package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;
import ru.slivkiai.flowdetect.service.CityService;

@RestController
@RequestMapping("/cities")
@RequiredArgsConstructor
public class CityController {

    private final CityService cityService;

    @PostMapping
    @Operation(summary = "Create new city")
    @ApiResponse(responseCode = "201", description = "City created successfully")
    public CityResponse createCity(@RequestBody CityRequest request) {
        return cityService.createCity(request);
    }
}
