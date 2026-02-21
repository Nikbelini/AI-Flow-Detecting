package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.slivkiai.flowdetect.domain.Route;
import ru.slivkiai.flowdetect.domain.RouteCreateRequest;
import ru.slivkiai.flowdetect.domain.RouteSearchRequest;
import ru.slivkiai.flowdetect.domain.RouteStop;
import ru.slivkiai.flowdetect.domain.RouteStopRequest;
import ru.slivkiai.flowdetect.domain.RouteUpdateRequest;
import ru.slivkiai.flowdetect.domain.entity.*;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.RouteRepository;
import ru.slivkiai.flowdetect.repository.RouteStopRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RouteService {

    private final RouteRepository routeRepository;
    private final RouteStopRepository routeStopRepository;
    private final CityRepository cityRepository;
    private final StopRepository stopRepository;

    @Transactional(readOnly = true)
    public List<Route> getAllRoutes() {
        List<RouteEntity> routes = routeRepository.findAll();
        return routes.stream()
                .map(this::convertTo)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Route getRouteById(Long id) {
        RouteEntity route = routeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Маршрут с ID " + id + " не найден"));
        return convertTo(route);
    }

    @Transactional
    public Route createRoute(RouteCreateRequest request) {
        log.info("Создание нового маршрута: {}", request.getNumber());

        // Явная проверка cityId
        if (request.getCityId() == null) {
            throw new IllegalArgumentException("ID города не может быть null");
        }

        // Проверка transportType перед вызовом name()
        if (request.getTransportType() == null) {
            throw new IllegalArgumentException("Тип транспорта не может быть null");
        }

        // Загрузка города
        CityEntity city = cityRepository.findById(request.getCityId())
                .orElseThrow(() -> new EntityNotFoundException("Город с ID " + request.getCityId() + " не найден"));

        // Проверка уникальности номера маршрута
        if (routeRepository.existsByNumberAndCityIdAndTransportType(
                request.getNumber(),
                request.getCityId(),
                request.getTransportType().name())) {
            throw new IllegalArgumentException("Маршрут с таким номером уже существует в этом городе");
        }

        // Создание маршрута
        RouteEntity route = RouteEntity.builder()
                .number(request.getNumber())
                .name(request.getName())
                .transportType(request.getTransportType())
                .city(city)
                .directionAName(request.getDirectionAName())
                .directionBName(request.getDirectionBName())
                .intervalMinutes(request.getIntervalMinutes())
                .operatingHours(request.getOperatingHours())
                .isActive(true)
                .build();

        RouteEntity savedRoute = routeRepository.save(route);

        // Добавление остановок
        if (request.getStops() != null && !request.getStops().isEmpty()) {
            addStopsToRoute(savedRoute, request.getStops());
        }

        log.info("Маршрут {} успешно создан с ID {}", request.getNumber(), savedRoute.getId());
        return convertTo(savedRoute);
    }

    @Transactional
    public Route updateRoute(Long id, RouteUpdateRequest request) {
        log.info("Обновление маршрута с ID: {}", id);

        RouteEntity route = routeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Маршрут с ID " + id + " не найден"));

        // Обновление полей
        if (request.getNumber() != null) {
            route.setNumber(request.getNumber());
        }
        if (request.getName() != null) {
            route.setName(request.getName());
        }
        if (request.getTransportType() != null) {
            route.setTransportType(request.getTransportType());
        }
        if (request.getIsActive() != null) {
            route.setIsActive(request.getIsActive());
        }
        if (request.getDirectionAName() != null) {
            route.setDirectionAName(request.getDirectionAName());
        }
        if (request.getDirectionBName() != null) {
            route.setDirectionBName(request.getDirectionBName());
        }
        if (request.getIntervalMinutes() != null) {
            route.setIntervalMinutes(request.getIntervalMinutes());
        }
        if (request.getOperatingHours() != null) {
            route.setOperatingHours(request.getOperatingHours());
        }

        RouteEntity updatedRoute = routeRepository.save(route);
        log.info("Маршрут с ID {} успешно обновлен", id);

        return convertTo(updatedRoute);
    }

    @Transactional
    public void deleteRoute(Long id) {
        log.info("Удаление маршрута с ID: {}", id);

        if (!routeRepository.existsById(id)) {
            throw new EntityNotFoundException("Маршрут с ID " + id + " не найден");
        }

        // Удаляем сначала связанные остановки
        routeStopRepository.deleteByRouteId(id);

        // Удаляем сам маршрут
        routeRepository.deleteById(id);

        log.info("Маршрут с ID {} успешно удален", id);
    }

    @Transactional
    public Route updateRouteStops(Long routeId, List<RouteStopRequest> stopRequests) {
        log.info("Обновление остановок для маршрута с ID: {}", routeId);

        RouteEntity route = routeRepository.findById(routeId)
                .orElseThrow(() -> new EntityNotFoundException("Маршрут с ID " + routeId + " не найден"));

        // Удаляем текущие остановки маршрута
        routeStopRepository.deleteByRouteId(routeId);

        // Добавляем новые остановки
        if (stopRequests != null && !stopRequests.isEmpty()) {
            addStopsToRoute(route, stopRequests);
        }

        // Обновляем маршрут
        RouteEntity updatedRoute = routeRepository.save(route);

        log.info("Остановки маршрута с ID {} успешно обновлены", routeId);
        return convertTo(updatedRoute);
    }

    @Transactional(readOnly = true)
    public List<Route> searchRoutes(RouteSearchRequest searchRequest) {
        List<RouteEntity> routes;

        if (searchRequest.getCityId() != null) {
            if (searchRequest.getTransportType() != null) {
                routes = routeRepository.findByCityIdAndTransportType(
                        searchRequest.getCityId(), searchRequest.getTransportType());
            } else if (searchRequest.getIsActive() != null && searchRequest.getIsActive()) {
                routes = routeRepository.findByCityIdAndIsActiveTrue(searchRequest.getCityId());
            } else if (searchRequest.getSearch() != null) {
                routes = routeRepository.searchInCity(searchRequest.getCityId(), searchRequest.getSearch());
            } else {
                // Просто все маршруты города
                routes = routeRepository.findAll().stream()
                        .filter(r -> r.getCity().getId().equals(searchRequest.getCityId()))
                        .collect(Collectors.toList());
            }
        } else {
            // Все маршруты
            routes = routeRepository.findAll();
        }

        // Фильтрация по активности если нужно
        if (searchRequest.getIsActive() != null) {
            routes = routes.stream()
                    .filter(r -> r.getIsActive().equals(searchRequest.getIsActive()))
                    .collect(Collectors.toList());
        }

        return routes.stream()
                .map(this::convertTo)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Route> getRoutesByStop(Long stopId) {
        List<RouteEntity> routes = routeRepository.findByStopId(stopId);
        return routes.stream()
                .map(this::convertTo)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RouteStop> getRouteStops(Long routeId, String direction) {
        List<RouteStopEntity> routeStops;

        if (direction != null && !direction.isEmpty()) {
            routeStops = routeStopRepository.findByRouteIdAndDirectionOrderByOrderInRoute(routeId, direction);
        } else {
            routeStops = routeStopRepository.findByRouteIdOrderByOrderInRoute(routeId);
        }

        return routeStops.stream()
                .map(this::convertRouteStopTo)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RouteStop> getStopRoutes(Long stopId) {
        List<RouteStopEntity> routeStops = routeStopRepository.findByStopId(stopId);
        return routeStops.stream()
                .map(this::convertRouteStopTo)
                .collect(Collectors.toList());
    }

    private void addStopsToRoute(RouteEntity route, List<RouteStopRequest> stopRequests) {
        List<RouteStopEntity> routeStops = new ArrayList<>();

        for (RouteStopRequest stopRequest : stopRequests) {
            if (stopRequest.getStopId() == null) {
                throw new IllegalArgumentException("ID остановки не может быть null");
            }

            StopEntity stop = stopRepository.findById(stopRequest.getStopId())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Остановка с ID " + stopRequest.getStopId() + " не найдена"));

            RouteStopEntity routeStop = RouteStopEntity.builder()
                    .route(route)
                    .stop(stop)
                    .orderInRoute(stopRequest.getOrder())
                    .direction(stopRequest.getDirection())
                    .travelTimeToNext(stopRequest.getTravelTimeToNext())
                    .isActive(true)
                    .build();

            routeStops.add(routeStop);
        }

        routeStopRepository.saveAll(routeStops);
    }

    private Route convertTo(RouteEntity route) {
        // Получаем остановки маршрута
        List<RouteStopEntity> routeStops = routeStopRepository.findByRouteIdOrderByOrderInRoute(route.getId());
        List<RouteStop> stopDTOs = routeStops.stream()
                .map(this::convertRouteStopTo)
                .collect(Collectors.toList());

        // Используем билдер
        return Route.builder()
                .id(route.getId())
                .number(route.getNumber())
                .name(route.getName())
                .transportType(route.getTransportType())
                .isActive(route.getIsActive())
                .cityId(route.getCity().getId())
                .cityName(route.getCity().getName())
                .directionAName(route.getDirectionAName())
                .directionBName(route.getDirectionBName())
                .intervalMinutes(route.getIntervalMinutes())
                .operatingHours(route.getOperatingHours())
                .stops(stopDTOs)
                .build();
    }

    private RouteStop convertRouteStopTo(RouteStopEntity routeStop) {
        StopEntity stop = routeStop.getStop();

        // Используем билдер
        return RouteStop.builder()
                .stopId(stop.getId())
                .address(stop.getAddress())
                .orderInRoute(routeStop.getOrderInRoute())
                .direction(routeStop.getDirection())
                .travelTimeToNext(routeStop.getTravelTimeToNext())
                .lat(stop.getLat())
                .lng(stop.getLng())
                .count(stop.getCount())
                .velocity(stop.getVelocity())
                .load(stop.getLoad())
                .build();
    }
}
