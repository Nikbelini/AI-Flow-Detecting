package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CityServiceImpl implements CityService {

    private final CityRepository cityRepository;

    @Override
    public CityResponse createCity(CityRequest request) {
        CityEntity city = new CityEntity();
        city.setName(request.getName());
        city.setLat(BigDecimal.valueOf(request.getLat()));
        city.setLng(BigDecimal.valueOf(request.getLng()));
        CityEntity savedCity = cityRepository.save(city);
        return new CityResponse(savedCity.getId(), savedCity.getName(), savedCity.getLat().doubleValue(), savedCity.getLng().doubleValue());
    }

    @Override
    public List<CityResponse> getAll() {
        return cityRepository.findAll().stream().map(city -> new CityResponse(city.getId(), city.getName(), city.getLng().doubleValue(), city.getLat().doubleValue())).collect(Collectors.toList());
    }


}
