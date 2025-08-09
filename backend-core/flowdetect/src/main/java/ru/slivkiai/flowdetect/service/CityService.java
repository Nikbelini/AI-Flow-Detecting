package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;

@Service
@RequiredArgsConstructor
public class CityService {

    private final CityRepository cityRepository;

    public CityResponse createCity(CityRequest request) {
        CityEntity city = new CityEntity();
        city.setName(request.getName());
        CityEntity savedCity = cityRepository.save(city);
        return new CityResponse(savedCity.getId(), savedCity.getName());
    }
}
