package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.slivkiai.flowdetect.client.FlowPredictionClient;
import ru.slivkiai.flowdetect.dto.RoutePlanRequestDto;
import ru.slivkiai.flowdetect.dto.RoutePlanResponseDto;
import ru.slivkiai.flowdetect.exception.RoutePlanningException;


@RestController
@RequestMapping("/routes")
@RequiredArgsConstructor
@Slf4j
public class RoutePlanningController {
    
    private final FlowPredictionClient flowPredictionClient;

    /**
     * Построение оптимального маршрута между выбранными остановками
     */
    @PostMapping("/build")
    public ResponseEntity<RoutePlanResponseDto> buildRoute(
            @RequestBody RoutePlanRequestDto request
    ) {
        log.info("Запрос на построение маршрута: cityId={}, mode={}, scheduledFor={}",
            request.getCityId(), request.getMode(), request.getScheduledFor());

        try {
            // Валидация входных данных
            validateRequest(request);

            // Установка дефолтных значений
            prepareRequest(request);

            // Вызов ML-сервиса
            RoutePlanResponseDto response = flowPredictionClient.buildOptimalRoute(request);

            // Обработка ответа
            if ("ERROR".equalsIgnoreCase(response.getStatus())) {
                log.warn("Ошибка от ML-сервиса: {}", response.getError());
                return ResponseEntity.badRequest().body(response);
            }

            int alternativesCount = response.getAlternatives() != null ? response.getAlternatives().size() : 0;

            log.info("Маршрут успешно построен: время={:.2f} мин, сегментов={}, альтернатив={}",
                    response.getTotalCostMinutes(),
                    response.getSegments() != null ? response.getSegments().size() : 0,
                    alternativesCount);

            return ResponseEntity.ok(response);

        } catch (RoutePlanningException exception) {
            log.error("Ошибка планирования маршрута: {}", exception.getMessage(), exception);
            return ResponseEntity.badRequest().body(
                RoutePlanResponseDto.builder()
                    .status("ERROR")
                    .error(exception.getMessage())
                    .build()
            );
        } catch (Exception exception) {
            log.error("Неожиданная ошибка при построении маршрута", exception);
            return ResponseEntity.internalServerError().body(
                RoutePlanResponseDto.builder()
                    .status("ERROR")
                    .error("Внутренняя ошибка сервера: " + exception.getMessage())
                    .build()
            );
        }
    }

    /**
     * Валидация входного запроса
     */
    private void validateRequest(RoutePlanRequestDto request) {
        if (request.getCityId() == null || request.getCityId() <= 0) {
            throw new RoutePlanningException("city_id обязателен и должен быть положительным");
        }
        
        if (request.getDatetime() == null || request.getDatetime().isBlank()) {
            throw new RoutePlanningException("datetime обязателен");
        }
    }

    /**
     * Подготовка запроса: установка дефолтных значений
     */
    private void prepareRequest(RoutePlanRequestDto request) {
        // Дефолтный режим, если не указан
        if (request.getMode() == null) {
            request.setMode(RoutePlanRequestDto.RouteMode.FASTEST);
        }

        // Форматирование даты, если нужно
        if (request.getDatetime() != null && !request.getDatetime().contains("T")) {
            // Преобразуем "2026-04-09 22:03:32" → "2026-04-09T22:03:32"
            request.setDatetime(request.getDatetime().replace(' ', 'T'));
        }
    }

    /**
     * Получение доступных режимов маршрутизации (для справки фронтенду)
     */
    @GetMapping("/modes")
    public ResponseEntity<?> getAvailableModes() {
        return ResponseEntity.ok(new ModeInfo(
            RoutePlanRequestDto.RouteMode.values()
        ));
    }

    // Вспомогательный класс для ответа о режимах
    @lombok.Data
    @lombok.AllArgsConstructor
    public static class ModeInfo {
        private RoutePlanRequestDto.RouteMode[] modes;
    }
}
