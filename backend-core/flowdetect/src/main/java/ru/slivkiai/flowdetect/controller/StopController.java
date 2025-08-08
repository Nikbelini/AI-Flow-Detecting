package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.service.StopService;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/stops")
public class StopController {
    private final StopService stopService;

    @GetMapping
    public Map<String, List<StopResponse>> getStops() {
        return Map.of("stops", stopService.getAllStops());
    }
}
