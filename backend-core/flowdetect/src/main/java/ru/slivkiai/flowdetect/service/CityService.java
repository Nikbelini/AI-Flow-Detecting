package ru.slivkiai.flowdetect.service;

import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;

import java.util.List;

public interface CityService {
    CityResponse createCity(CityRequest request);

    List<CityResponse> getAll();
}
