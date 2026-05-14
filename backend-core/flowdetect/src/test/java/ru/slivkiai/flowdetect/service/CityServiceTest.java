package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.domain.CityRequest;
import ru.slivkiai.flowdetect.domain.CityResponse;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class CityServiceTest {
    @Mock
    private CityRepository cityRepository;

    @InjectMocks
    private CityServiceImpl cityService;

    @Test
    @DisplayName("createCity — успешное создание города (позитивный)")
    void createCity_success() {
        CityRequest request = new CityRequest("Казань", 55.7887, 49.1221);
        CityEntity savedEntity = CityEntity.builder()
                .id(10L)
                .name("Казань")
                .lat(BigDecimal.valueOf(55.7887))
                .lng(BigDecimal.valueOf(49.1221))
                .build();

        given(cityRepository.save(any(CityEntity.class))).willReturn(savedEntity);

        CityResponse response = cityService.createCity(request);

        assertThat(response.getId()).isEqualTo(10L);
        assertThat(response.getName()).isEqualTo("Казань");
        assertThat(response.getLat()).isEqualTo(55.7887);
        assertThat(response.getLng()).isEqualTo(49.1221);

        ArgumentCaptor<CityEntity> captor = ArgumentCaptor.forClass(CityEntity.class);
        verify(cityRepository).save(captor.capture());
        CityEntity captured = captor.getValue();
        assertThat(captured.getName()).isEqualTo("Казань");
        assertThat(captured.getLat()).isEqualTo(BigDecimal.valueOf(55.7887));
        assertThat(captured.getLng()).isEqualTo(BigDecimal.valueOf(49.1221));
    }

    @Test
    @DisplayName("createCity — попытка сохранить город с null именем (негативный)")
    void createCity_nullName() {
        CityRequest request = new CityRequest(null, 55.0, 37.0);
        // Здесь ожидаем, что репозиторий выбросит исключение при попытке сохранить
        given(cityRepository.save(any(CityEntity.class)))
                .willThrow(new RuntimeException("Name cannot be null"));

        assertThatThrownBy(() -> cityService.createCity(request))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("getAll — возвращает список городов (позитивный)")
    void getAll_success() {
        CityEntity city1 = CityEntity.builder()
                .id(1L).name("Москва").lat(BigDecimal.valueOf(55.7558)).lng(BigDecimal.valueOf(37.6176)).build();
        CityEntity city2 = CityEntity.builder()
                .id(2L).name("СПб").lat(BigDecimal.valueOf(59.9343)).lng(BigDecimal.valueOf(30.3351)).build();
        given(cityRepository.findAll()).willReturn(List.of(city1, city2));

        List<CityResponse> result = cityService.getAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("Москва");
        assertThat(result.get(1).getName()).isEqualTo("СПб");
    }

    @Test
    @DisplayName("getAll — пустая база возвращает пустой список (позитивный)")
    void getAll_empty() {
        given(cityRepository.findAll()).willReturn(List.of());
        List<CityResponse> result = cityService.getAll();
        assertThat(result).isEmpty();
    }
}
