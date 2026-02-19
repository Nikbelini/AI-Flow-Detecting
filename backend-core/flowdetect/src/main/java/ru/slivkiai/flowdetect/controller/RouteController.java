package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.slivkiai.flowdetect.domain.Route;
import ru.slivkiai.flowdetect.domain.RouteCreateRequest;
import ru.slivkiai.flowdetect.domain.RouteSearchRequest;
import ru.slivkiai.flowdetect.domain.RouteStop;
import ru.slivkiai.flowdetect.domain.RouteStopRequest;
import ru.slivkiai.flowdetect.domain.RouteUpdateRequest;
import ru.slivkiai.flowdetect.service.RouteService;

import java.util.List;

@RestController
@RequestMapping("/routes")
@RequiredArgsConstructor
@Tag(name = "Маршруты транспорта", description = "API для управления маршрутами общественного транспорта")
public class RouteController {

    private final RouteService routeService;

    @GetMapping
    @Operation(summary = "Получить все маршруты",
            description = "Возвращает список всех маршрутов транспорта")
    public ResponseEntity<List<Route>> getAllRoutes() {
        List<Route> routes = routeService.getAllRoutes();
        return ResponseEntity.ok(routes);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Получить маршрут по ID",
            description = "Возвращает подробную информацию о маршруте")
    public ResponseEntity<Route> getRouteById(
            @Parameter(description = "Идентификатор маршрута", required = true, example = "1")
            @PathVariable Long id) {
        Route route = routeService.getRouteById(id);
        return ResponseEntity.ok(route);
    }

    @PostMapping
    @Operation(summary = "Создать новый маршрут",
            description = "Создает новый маршрут с указанными параметрами")
    public ResponseEntity<Route> createRoute(
            @Parameter(description = "Данные для создания маршрута", required = true)
            @Valid @RequestBody RouteCreateRequest request) {
        Route createdRoute = routeService.createRoute(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdRoute);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Обновить маршрут",
            description = "Обновляет информацию о существующем маршруте")
    public ResponseEntity<Route> updateRoute(
            @Parameter(description = "Идентификатор маршрута", required = true, example = "1")
            @PathVariable Long id,
            @Parameter(description = "Данные для обновления", required = true)
            @Valid @RequestBody RouteUpdateRequest request) {
        Route updatedRoute = routeService.updateRoute(id, request);
        return ResponseEntity.ok(updatedRoute);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Удалить маршрут",
            description = "Удаляет маршрут и все связанные с ним данные")
    public ResponseEntity<Void> deleteRoute(
            @Parameter(description = "Идентификатор маршрута", required = true, example = "1")
            @PathVariable Long id) {
        routeService.deleteRoute(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/search")
    @Operation(summary = "Поиск маршрутов",
            description = "Поиск маршрутов по заданным критериям")
    public ResponseEntity<List<Route>> searchRoutes(
            @Parameter(description = "Критерии поиска", required = true)
            @Valid @RequestBody RouteSearchRequest searchRequest) {
        List<Route> routes = routeService.searchRoutes(searchRequest);
        return ResponseEntity.ok(routes);
    }

    @GetMapping("/by-stop/{stopId}")
    @Operation(summary = "Маршруты по остановке",
            description = "Возвращает все маршруты, проходящие через указанную остановку")
    public ResponseEntity<List<Route>> getRoutesByStop(
            @Parameter(description = "Идентификатор остановки", required = true, example = "123")
            @PathVariable Long stopId) {
        List<Route> routes = routeService.getRoutesByStop(stopId);
        return ResponseEntity.ok(routes);
    }

    @GetMapping("/{id}/stops")
    @Operation(summary = "Остановки маршрута",
            description = "Возвращает остановки маршрута в порядке следования")
    public ResponseEntity<List<RouteStop>> getRouteStops(
            @Parameter(description = "Идентификатор маршрута", required = true, example = "1")
            @PathVariable Long id,
            @Parameter(description = "Направление маршрута (опционально)", example = "A")
            @RequestParam(required = false) String direction) {
        List<RouteStop> stops = routeService.getRouteStops(id, direction);
        return ResponseEntity.ok(stops);
    }

    @GetMapping("/stops/{stopId}/routes-info")
    @Operation(summary = "Информация об остановке в маршрутах",
            description = "Возвращает информацию о том, как остановка используется в различных маршрутах")
    public ResponseEntity<List<RouteStop>> getStopRoutes(
            @Parameter(description = "Идентификатор остановки", required = true, example = "123")
            @PathVariable Long stopId) {
        List<RouteStop> routeStops = routeService.getStopRoutes(stopId);
        return ResponseEntity.ok(routeStops);
    }

    @PutMapping("/{id}/stops")
    @Operation(summary = "Обновить остановки маршрута",
            description = "Полностью заменяет список остановок маршрута")
    public ResponseEntity<Route> updateRouteStops(
            @Parameter(description = "Идентификатор маршрута", required = true, example = "1")
            @PathVariable Long id,
            @Parameter(description = "Новый список остановок", required = true)
            @Valid @RequestBody List<RouteStopRequest> stopRequests) {
        Route updatedRoute = routeService.updateRouteStops(id, stopRequests);
        return ResponseEntity.ok(updatedRoute);
    }

    @PatchMapping("/{id}/activate")
    @Operation(summary = "Изменить активность маршрута",
            description = "Активирует или деактивирует маршрут")
    public ResponseEntity<Route> toggleRouteActive(
            @Parameter(description = "Идентификатор маршрута", required = true, example = "1")
            @PathVariable Long id,
            @Parameter(description = "Статус активности", required = true, example = "true")
            @RequestParam Boolean active) {
        RouteUpdateRequest request = RouteUpdateRequest.builder()
                .isActive(active)
                .build();
        Route updatedRoute = routeService.updateRoute(id, request);
        return ResponseEntity.ok(updatedRoute);
    }

    @GetMapping("/city/{cityId}")
    @Operation(summary = "Маршруты по городу",
            description = "Возвращает все маршруты в указанном городе")
    public ResponseEntity<List<Route>> getRoutesByCity(
            @Parameter(description = "Идентификатор города", required = true, example = "1")
            @PathVariable Long cityId,
            @Parameter(description = "Тип транспорта (опционально)", example = "BUS")
            @RequestParam(required = false) String transportType,
            @Parameter(description = "Только активные маршруты (опционально)", example = "true")
            @RequestParam(required = false) Boolean activeOnly) {

        RouteSearchRequest searchRequest = RouteSearchRequest.builder()
                .cityId(cityId)
                .transportType(transportType != null ?
                        ru.slivkiai.flowdetect.domain.entity.TransportType.valueOf(transportType) : null)
                .isActive(activeOnly)
                .build();

        List<Route> routes = routeService.searchRoutes(searchRequest);
        return ResponseEntity.ok(routes);
    }

    @GetMapping("/{id}/directions")
    @Operation(summary = "Направления маршрута",
            description = "Возвращает информацию о направлениях маршрута")
    public ResponseEntity<RouteDirectionsResponse> getRouteDirections(
            @Parameter(description = "Идентификатор маршрута", required = true, example = "1")
            @PathVariable Long id) {
        Route route = routeService.getRouteById(id);

        List<RouteStop> directionA = routeService.getRouteStops(id, "A");
        List<RouteStop> directionB = routeService.getRouteStops(id, "B");

        RouteDirectionsResponse response = RouteDirectionsResponse.builder()
                .routeId(id)
                .routeNumber(route.getNumber())
                .routeName(route.getName())
                .directionAName(route.getDirectionAName())
                .directionBName(route.getDirectionBName())
                .directionA(directionA)
                .directionB(directionB)
                .build();

        return ResponseEntity.ok(response);
    }

    // Вспомогательный DTO для ответа с направлениями
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    static class RouteDirectionsResponse {
        private Long routeId;
        private String routeNumber;
        private String routeName;
        private String directionAName;
        private String directionBName;
        private List<RouteStop> directionA;
        private List<RouteStop> directionB;
    }
}