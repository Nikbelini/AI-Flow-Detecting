package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.domain.*;
import ru.slivkiai.flowdetect.domain.entity.*;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.RouteRepository;
import ru.slivkiai.flowdetect.repository.RouteStopRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Тестирование сервиса маршрутов")
class RouteServiceTest {

        @Mock
        private RouteRepository routeRepository;

        @Mock
        private RouteStopRepository routeStopRepository;

        @Mock
        private CityRepository cityRepository;

        @Mock
        private StopRepository stopRepository;

        @InjectMocks
        private RouteService routeService;

        private CityEntity testCity;
        private StopEntity testStop1;
        private StopEntity testStop2;
        private RouteEntity testRoute;
        private RouteStopEntity testRouteStop1;
        private RouteStopEntity testRouteStop2;

        @BeforeEach
        void setUp() {
                // Подготовка тестовых данных
                testCity = CityEntity.builder()
                                .id(1L)
                                .name("Москва")
                                .lat(new BigDecimal("55.755826"))
                                .lng(new BigDecimal("37.617300"))
                                .build();

                testStop1 = StopEntity.builder()
                                .id(1L)
                                .url("http://example.com/stop1")
                                .address("Улица Ленина, 1")
                                .count(100)
                                .velocity(30)
                                .load(60)
                                .city(testCity)
                                .lat(new BigDecimal("55.755826"))
                                .lng(new BigDecimal("37.617300"))
                                .build();

                testStop2 = StopEntity.builder()
                                .id(2L)
                                .url("http://example.com/stop2")
                                .address("Улица Пушкина, 10")
                                .count(80)
                                .velocity(25)
                                .load(70)
                                .city(testCity)
                                .lat(new BigDecimal("55.751244"))
                                .lng(new BigDecimal("37.618423"))
                                .build();

                testRoute = RouteEntity.builder()
                                .id(1L)
                                .number("105")
                                .name("Центр - Южный район")
                                .transportType(TransportType.BUS)
                                .isActive(true)
                                .city(testCity)
                                .directionAName("Центральный вокзал")
                                .directionBName("Южный микрорайон")
                                .intervalMinutes(15)
                                .operatingHours("06:00-23:00")
                                .build();

                testRouteStop1 = RouteStopEntity.builder()
                                .route(testRoute)
                                .stop(testStop1)
                                .orderInRoute(1)
                                .direction("A")
                                .travelTimeToNext(5)
                                .isActive(true)
                                .build();

                testRouteStop2 = RouteStopEntity.builder()
                                .route(testRoute)
                                .stop(testStop2)
                                .orderInRoute(2)
                                .direction("A")
                                .travelTimeToNext(7)
                                .isActive(true)
                                .build();
        }

        @Test
        @DisplayName("Успешное получение всех маршрутов")
        void getAllRoutes_ShouldReturnAllRoutes() {
                // Arrange
                List<RouteEntity> routes = Arrays.asList(testRoute);
                when(routeRepository.findAll()).thenReturn(routes);
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(anyLong()))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                List<Route> result = routeService.getAllRoutes();

                // Assert
                assertThat(result).isNotEmpty();
                assertThat(result).hasSize(1);
                assertThat(result.get(0).getNumber()).isEqualTo("105");
                assertThat(result.get(0).getStops()).hasSize(2);

                verify(routeRepository, times(1)).findAll();
                verify(routeStopRepository, times(1)).findByRouteIdOrderByOrderInRoute(1L);
        }

        @Test
        @DisplayName("Получение маршрута по существующему ID")
        void getRouteById_WithExistingId_ShouldReturnRoute() {
                // Arrange
                Long routeId = 1L;
                when(routeRepository.findById(routeId)).thenReturn(Optional.of(testRoute));
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(routeId))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                Route result = routeService.getRouteById(routeId);

                // Assert
                assertThat(result).isNotNull();
                assertThat(result.getId()).isEqualTo(routeId);
                assertThat(result.getNumber()).isEqualTo("105");
                assertThat(result.getName()).isEqualTo("Центр - Южный район");
                assertThat(result.getTransportType()).isEqualTo(TransportType.BUS);
                assertThat(result.getStops()).hasSize(2);

                verify(routeRepository, times(1)).findById(routeId);
                verify(routeStopRepository, times(1)).findByRouteIdOrderByOrderInRoute(routeId);
        }

        @Test
        @DisplayName("Получение маршрута по несуществующему ID должно выбрасывать исключение")
        void getRouteById_WithNonExistingId_ShouldThrowException() {
                // Arrange
                Long routeId = 999L;
                when(routeRepository.findById(routeId)).thenReturn(Optional.empty());

                // Act & Assert
                assertThatThrownBy(() -> routeService.getRouteById(routeId))
                                .isInstanceOf(EntityNotFoundException.class)
                                .hasMessageContaining("Маршрут с ID 999 не найден");

                verify(routeRepository, times(1)).findById(routeId);
                verify(routeStopRepository, never()).findByRouteIdOrderByOrderInRoute(anyLong());
        }

        @Test
        @DisplayName("Успешное создание маршрута")
        void createRoute_WithValidData_ShouldCreateRoute() {
                // Arrange
                RouteCreateRequest request = RouteCreateRequest.builder()
                                .number("105")
                                .name("Центр - Южный район")
                                .transportType(TransportType.BUS)
                                .cityId(1L)
                                .directionAName("Центральный вокзал")
                                .directionBName("Южный микрорайон")
                                .intervalMinutes(15)
                                .operatingHours("06:00-23:00")
                                .stops(Arrays.asList(
                                                RouteStopRequest.builder()
                                                                .stopId(1L)
                                                                .order(1)
                                                                .direction("A")
                                                                .travelTimeToNext(5)
                                                                .build(),
                                                RouteStopRequest.builder()
                                                                .stopId(2L)
                                                                .order(2)
                                                                .direction("A")
                                                                .travelTimeToNext(7)
                                                                .build()))
                                .build();

                when(cityRepository.findById(1L)).thenReturn(Optional.of(testCity));
                when(routeRepository.existsByNumberAndCityIdAndTransportType(
                                "105", 1L, String.valueOf(TransportType.BUS))).thenReturn(false);
                when(routeRepository.save(any(RouteEntity.class))).thenReturn(testRoute);
                when(stopRepository.findById(1L)).thenReturn(Optional.of(testStop1));
                when(stopRepository.findById(2L)).thenReturn(Optional.of(testStop2));
                when(routeStopRepository.saveAll(anyList())).thenReturn(Arrays.asList(
                                testRouteStop1, testRouteStop2));
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                Route result = routeService.createRoute(request);

                // Assert
                assertThat(result).isNotNull();
                assertThat(result.getNumber()).isEqualTo("105");
                assertThat(result.getCityId()).isEqualTo(1L);
                assertThat(result.getStops()).hasSize(2);

                verify(cityRepository, times(1)).findById(1L);
                verify(routeRepository, times(1)).existsByNumberAndCityIdAndTransportType(
                                "105", 1L, String.valueOf(TransportType.BUS));
                verify(routeRepository, times(1)).save(any(RouteEntity.class));
                verify(stopRepository, times(2)).findById(anyLong());
                verify(routeStopRepository, times(1)).saveAll(anyList());
        }

        @Test
        @DisplayName("Создание маршрута с дублирующимся номером должно выбрасывать исключение")
        void createRoute_WithDuplicateNumber_ShouldThrowException() {
                // Arrange
                RouteCreateRequest request = RouteCreateRequest.builder()
                                .number("105")
                                .transportType(TransportType.BUS)
                                .cityId(1L)
                                .build();

                when(cityRepository.findById(1L)).thenReturn(Optional.of(testCity));
                when(routeRepository.existsByNumberAndCityIdAndTransportType(
                                "105", 1L, String.valueOf(TransportType.BUS))).thenReturn(true);

                // Act & Assert
                assertThatThrownBy(() -> routeService.createRoute(request))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining(
                                                "Маршрут с таким номером уже существует в этом городе");

                verify(cityRepository, times(1)).findById(1L);
                verify(routeRepository, times(1)).existsByNumberAndCityIdAndTransportType(
                                "105", 1L, String.valueOf(TransportType.BUS));
                verify(routeRepository, never()).save(any(RouteEntity.class));
        }

        @Test
    @DisplayName("Успешное создание")
    void createRoute_success() {
        RouteCreateRequest request = RouteCreateRequest.builder()
                .number("105")
                .name("Тестовый маршрут")
                .transportType(TransportType.BUS)
                .cityId(1L)
                .build();

        when(cityRepository.findById(1L)).thenReturn(Optional.of(testCity));
        when(routeRepository.existsByNumberAndCityIdAndTransportType("105", 1L, "BUS"))
                .thenReturn(false);
        when(routeRepository.save(any(RouteEntity.class))).thenReturn(testRoute);

        Route result = routeService.createRoute(request);

        assertThat(result.getNumber()).isEqualTo("105");
        verify(cityRepository).findById(1L);
        verify(routeRepository).save(any(RouteEntity.class));
    }

    @Test
    @DisplayName("transportType = null → IllegalArgumentException")
    void createRoute_nullTransportType() {
        RouteCreateRequest request = RouteCreateRequest.builder()
                .cityId(1L)
                .number("105")
                // transportType намеренно не указан → null
                .build();

        // Исключение должно быть брошено ДО любого обращения к репозиториям
        assertThatThrownBy(() -> routeService.createRoute(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Тип транспорта не может быть null");

        // Репозитории не должны вызываться
        verify(cityRepository, never()).findById(anyLong());
        verify(routeRepository, never()).existsByNumberAndCityIdAndTransportType(any(), any(), any());
        verify(routeRepository, never()).save(any());
    }

    @Test
    @DisplayName("Город не найден → EntityNotFoundException")
    void createRoute_nonExistingCity() {
        RouteCreateRequest request = RouteCreateRequest.builder()
                .number("999")
                .transportType(TransportType.BUS)  // ← обязательно!
                .cityId(999L)
                .build();

        when(cityRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.createRoute(request))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Город с ID 999 не найден");

        verify(cityRepository).findById(999L);
        verify(routeRepository, never()).existsByNumberAndCityIdAndTransportType(any(), any(), any());
        verify(routeRepository, never()).save(any());
    }

    @Test
    @DisplayName("Дубликат маршрута → IllegalArgumentException")
    void createRoute_duplicate() {
        RouteCreateRequest request = RouteCreateRequest.builder()
                .number("105")
                .transportType(TransportType.BUS)
                .cityId(1L)
                .build();

        when(cityRepository.findById(1L)).thenReturn(Optional.of(testCity));
        when(routeRepository.existsByNumberAndCityIdAndTransportType("105", 1L, "BUS"))
                .thenReturn(true);  // ← уже существует

        assertThatThrownBy(() -> routeService.createRoute(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("уже существует");

        verify(cityRepository).findById(1L);
        verify(routeRepository).existsByNumberAndCityIdAndTransportType("105", 1L, "BUS");
        verify(routeRepository, never()).save(any());
    }

        @Test
        @DisplayName("Создание маршрута с несуществующим городом должно выбрасывать исключение")
        void createRoute_WithNonExistingCity_ShouldThrowException() {
                // Arrange
                RouteCreateRequest request = RouteCreateRequest.builder()
                                .cityId(999L)
                                .number("999")
                                .transportType(TransportType.BUS)
                                .build();

                when(cityRepository.findById(999L)).thenReturn(Optional.empty());

                // Act & Assert
                assertThatThrownBy(() -> routeService.createRoute(request))
                        .isInstanceOf(EntityNotFoundException.class)
                        .hasMessageContaining("Город с ID 999 не найден");

                verify(cityRepository, times(1)).findById(999L);
                verify(routeRepository, never()).existsByNumberAndCityIdAndTransportType(anyString(), anyLong(), any());
                verify(routeRepository, never()).save(any(RouteEntity.class));
        }

        @Test
        @DisplayName("Успешное обновление маршрута")
        void updateRoute_WithValidData_ShouldUpdateRoute() {
                // Arrange
                Long routeId = 1L;
                RouteUpdateRequest request = RouteUpdateRequest.builder()
                                .number("105А")
                                .name("Обновленный маршрут")
                                .isActive(false)
                                .intervalMinutes(20)
                                .build();

                RouteEntity updatedRoute = RouteEntity.builder()
                                .id(routeId)
                                .number("105А")
                                .name("Обновленный маршрут")
                                .transportType(TransportType.BUS)
                                .isActive(false)
                                .city(testCity)
                                .directionAName("Центральный вокзал")
                                .directionBName("Южный микрорайон")
                                .intervalMinutes(20)
                                .operatingHours("06:00-23:00")
                                .build();

                when(routeRepository.findById(routeId)).thenReturn(Optional.of(testRoute));
                when(routeRepository.save(any(RouteEntity.class))).thenReturn(updatedRoute);
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(routeId))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                Route result = routeService.updateRoute(routeId, request);

                // Assert
                assertThat(result).isNotNull();
                assertThat(result.getNumber()).isEqualTo("105А");
                assertThat(result.getName()).isEqualTo("Обновленный маршрут");
                assertThat(result.getIsActive()).isFalse();
                assertThat(result.getIntervalMinutes()).isEqualTo(20);

                verify(routeRepository, times(1)).findById(routeId);
                verify(routeRepository, times(1)).save(any(RouteEntity.class));
        }

        @Test
        @DisplayName("Удаление существующего маршрута")
        void deleteRoute_WithExistingId_ShouldDeleteRoute() {
                // Arrange
                Long routeId = 1L;
                when(routeRepository.existsById(routeId)).thenReturn(true);

                // Act
                routeService.deleteRoute(routeId);

                // Assert
                verify(routeRepository, times(1)).existsById(routeId);
                verify(routeStopRepository, times(1)).deleteByRouteId(routeId);
                verify(routeRepository, times(1)).deleteById(routeId);
        }

        @Test
        @DisplayName("Удаление несуществующего маршрута должно выбрасывать исключение")
        void deleteRoute_WithNonExistingId_ShouldThrowException() {
                // Arrange
                Long routeId = 999L;
                when(routeRepository.existsById(routeId)).thenReturn(false);

                // Act & Assert
                assertThatThrownBy(() -> routeService.deleteRoute(routeId))
                                .isInstanceOf(EntityNotFoundException.class)
                                .hasMessageContaining("Маршрут с ID 999 не найден");

                verify(routeRepository, times(1)).existsById(routeId);
                verify(routeStopRepository, never()).deleteByRouteId(anyLong());
                verify(routeRepository, never()).deleteById(anyLong());
        }

        @Test
        @DisplayName("Успешное обновление остановок маршрута")
        void updateRouteStops_ShouldUpdateStops() {
                // Arrange
                Long routeId = 1L;
                List<RouteStopRequest> stopRequests = Arrays.asList(
                                RouteStopRequest.builder()
                                                .stopId(1L)
                                                .order(1)
                                                .direction("A")
                                                .travelTimeToNext(5)
                                                .build(),
                                RouteStopRequest.builder()
                                                .stopId(2L)
                                                .order(2)
                                                .direction("A")
                                                .travelTimeToNext(7)
                                                .build());

                when(routeRepository.findById(routeId)).thenReturn(Optional.of(testRoute));
                when(stopRepository.findById(1L)).thenReturn(Optional.of(testStop1));
                when(stopRepository.findById(2L)).thenReturn(Optional.of(testStop2));
                when(routeRepository.save(any(RouteEntity.class))).thenReturn(testRoute);
                when(routeStopRepository.saveAll(anyList())).thenReturn(Arrays.asList(
                                testRouteStop1, testRouteStop2));
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(routeId))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                Route result = routeService.updateRouteStops(routeId, stopRequests);

                // Assert
                assertThat(result).isNotNull();
                assertThat(result.getId()).isEqualTo(routeId);

                verify(routeRepository, times(1)).findById(routeId);
                verify(routeStopRepository, times(1)).deleteByRouteId(routeId);
                verify(stopRepository, times(2)).findById(anyLong());
                verify(routeStopRepository, times(1)).saveAll(anyList());
                verify(routeRepository, times(1)).save(any(RouteEntity.class));
        }

        @Test
        @DisplayName("Поиск маршрутов по городу и типу транспорта")
        void searchRoutes_ByCityAndTransportType_ShouldReturnRoutes() {
                // Arrange
                RouteSearchRequest searchRequest = RouteSearchRequest.builder()
                                .cityId(1L)
                                .transportType(TransportType.BUS)
                                .build();

                List<RouteEntity> routes = Arrays.asList(testRoute);
                when(routeRepository.findByCityIdAndTransportType(1L, TransportType.BUS))
                                .thenReturn(routes);
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                List<Route> result = routeService.searchRoutes(searchRequest);

                // Assert
                assertThat(result).isNotEmpty();
                assertThat(result).hasSize(1);
                assertThat(result.get(0).getTransportType()).isEqualTo(TransportType.BUS);
                assertThat(result.get(0).getCityId()).isEqualTo(1L);

                verify(routeRepository, times(1)).findByCityIdAndTransportType(1L, TransportType.BUS);
        }

        @Test
        @DisplayName("Поиск маршрутов по городу с поисковым запросом")
        void searchRoutes_ByCityWithSearch_ShouldReturnRoutes() {
                // Arrange
                RouteSearchRequest searchRequest = RouteSearchRequest.builder()
                                .cityId(1L)
                                .search("центр")
                                .build();

                List<RouteEntity> routes = Arrays.asList(testRoute);
                when(routeRepository.searchInCity(1L, "центр")).thenReturn(routes);
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                List<Route> result = routeService.searchRoutes(searchRequest);

                // Assert
                assertThat(result).isNotEmpty();
                assertThat(result.get(0).getName()).contains("Центр");

                verify(routeRepository, times(1)).searchInCity(1L, "центр");
        }

        @Test
        @DisplayName("Получение маршрутов по остановке")
        void getRoutesByStop_ShouldReturnRoutes() {
                // Arrange
                Long stopId = 1L;
                List<RouteEntity> routes = Arrays.asList(testRoute);
                when(routeRepository.findByStopId(stopId)).thenReturn(routes);
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L))
                                .thenReturn(Arrays.asList(testRouteStop1));

                // Act
                List<Route> result = routeService.getRoutesByStop(stopId);

                // Assert
                assertThat(result).isNotEmpty();
                assertThat(result).hasSize(1);
                assertThat(result.get(0).getStops()).anyMatch(stop -> stop.getStopId().equals(stopId));

                verify(routeRepository, times(1)).findByStopId(stopId);
        }

        @Test
        @DisplayName("Получение остановок маршрута с указанием направления")
        void getRouteStops_WithDirection_ShouldReturnOrderedStops() {
                // Arrange
                Long routeId = 1L;
                String direction = "A";
                List<RouteStopEntity> routeStops = Arrays.asList(testRouteStop1, testRouteStop2);

                when(routeStopRepository.findByRouteIdAndDirectionOrderByOrderInRoute(routeId, direction))
                                .thenReturn(routeStops);

                // Act
                List<RouteStop> result = routeService.getRouteStops(routeId, direction);

                // Assert
                assertThat(result).isNotEmpty();
                assertThat(result).hasSize(2);
                assertThat(result.get(0).getOrderInRoute()).isEqualTo(1);
                assertThat(result.get(1).getOrderInRoute()).isEqualTo(2);
                assertThat(result.get(0).getDirection()).isEqualTo("A");

                verify(routeStopRepository, times(1))
                                .findByRouteIdAndDirectionOrderByOrderInRoute(routeId, direction);
        }

        @Test
        @DisplayName("Получение остановок маршрута без направления")
        void getRouteStops_WithoutDirection_ShouldReturnAllStops() {
                // Arrange
                Long routeId = 1L;
                List<RouteStopEntity> routeStops = Arrays.asList(testRouteStop1, testRouteStop2);

                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(routeId))
                                .thenReturn(routeStops);

                // Act
                List<RouteStop> result = routeService.getRouteStops(routeId, null);

                // Assert
                assertThat(result).isNotEmpty();
                assertThat(result).hasSize(2);

                verify(routeStopRepository, times(1)).findByRouteIdOrderByOrderInRoute(routeId);
                verify(routeStopRepository, never())
                                .findByRouteIdAndDirectionOrderByOrderInRoute(anyLong(), anyString());
        }

        @Test
        @DisplayName("Получение маршрутов остановки")
        void getStopRoutes_ShouldReturnRouteStops() {
                // Arrange
                Long stopId = 1L;
                List<RouteStopEntity> routeStops = Arrays.asList(testRouteStop1);

                when(routeStopRepository.findByStopId(stopId)).thenReturn(routeStops);

                // Act
                List<RouteStop> result = routeService.getStopRoutes(stopId);

                // Assert
                assertThat(result).isNotEmpty();
                assertThat(result).hasSize(1);
                assertThat(result.get(0).getStopId()).isEqualTo(stopId);

                verify(routeStopRepository, times(1)).findByStopId(stopId);
        }

        @Test
        @DisplayName("Поиск маршрутов без критериев должен возвращать все маршруты")
        void searchRoutes_WithoutCriteria_ShouldReturnAllRoutes() {
                // Arrange
                RouteSearchRequest searchRequest = RouteSearchRequest.builder().build();
                List<RouteEntity> allRoutes = Arrays.asList(testRoute);

                when(routeRepository.findAll()).thenReturn(allRoutes);
                when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L))
                                .thenReturn(Arrays.asList(testRouteStop1, testRouteStop2));

                // Act
                List<Route> result = routeService.searchRoutes(searchRequest);

                // Assert
                assertThat(result).isNotEmpty();
                verify(routeRepository, times(1)).findAll();
        }

        /*
         * @Test
         * 
         * @DisplayName("Поиск маршрутов с фильтром по активности")
         * void searchRoutes_WithActiveFilter_ShouldReturnFilteredRoutes() {
         * // Arrange
         * RouteSearchRequest searchRequest = RouteSearchRequest.builder()
         * .isActive(true)
         * .build();
         * 
         * RouteEntity inactiveRoute = RouteEntity.builder()
         * .id(2L)
         * .number("106")
         * .transportType(TransportType.BUS)
         * .isActive(false)
         * .city(testCity)
         * .build();
         * 
         * List<RouteEntity> allRoutes = Arrays.asList(testRoute, inactiveRoute);
         * 
         * when(routeRepository.findAll()).thenReturn(allRoutes);
         * when(routeStopRepository.findByRouteIdOrderByOrderInRoute(1L))
         * .thenReturn(Collections.emptyList());
         * when(routeStopRepository.findByRouteIdOrderByOrderInRoute(2L))
         * .thenReturn(Collections.emptyList());
         * 
         * // Act
         * List<Route> result = routeService.searchRoutes(searchRequest);
         * 
         * // Assert
         * assertThat(result).hasSize(1);
         * assertThat(result.get(0).getIsActive()).isTrue();
         * assertThat(result.get(0).getNumber()).isEqualTo("105");
         * }
         */

        @Test
        @DisplayName("Обновление остановок маршрута с несуществующей остановкой должно выбрасывать исключение")
        void updateRouteStops_WithNonExistingStop_ShouldThrowException() {
                // Arrange
                Long routeId = 1L;
                List<RouteStopRequest> stopRequests = Arrays.asList(
                                RouteStopRequest.builder()
                                                .stopId(999L) // Несуществующая остановка
                                                .order(1)
                                                .direction("A")
                                                .build());

                when(routeRepository.findById(routeId)).thenReturn(Optional.of(testRoute));
                when(stopRepository.findById(999L)).thenReturn(Optional.empty());

                // Act & Assert
                assertThatThrownBy(() -> routeService.updateRouteStops(routeId, stopRequests))
                                .isInstanceOf(EntityNotFoundException.class)
                                .hasMessageContaining("Остановка с ID 999 не найдена");

                verify(routeRepository, times(1)).findById(routeId);
                verify(routeStopRepository, times(1)).deleteByRouteId(routeId);
                verify(stopRepository, times(1)).findById(999L);
                verify(routeStopRepository, never()).saveAll(anyList());
        }
}