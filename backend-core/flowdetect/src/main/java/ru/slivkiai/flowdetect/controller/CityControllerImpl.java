package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;
import ru.slivkiai.flowdetect.service.CityService;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CityControllerImpl implements CityController{

    private final CityService cityServiceImpl;

    @Override
    public CityResponse createCity(CityRequest request) {
        return cityServiceImpl.createCity(request);
    }

    @Override
    public List<CityResponse> getAllCities() {
        return cityServiceImpl.getAll();
    }
}
