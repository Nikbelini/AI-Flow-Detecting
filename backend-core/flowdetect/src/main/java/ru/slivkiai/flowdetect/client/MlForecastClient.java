package ru.slivkiai.flowdetect.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import ru.slivkiai.flowdetect.config.FeignConfig;
import ru.slivkiai.flowdetect.domain.external.MlForecastRequest;
import ru.slivkiai.flowdetect.domain.external.MlForecastResponse;

@FeignClient(
        name = "ml-forecast-service",
        url = "${ml.forecast.service.url:http://localhost:8082}",
        configuration = FeignConfig.class
)
public interface MlForecastClient {

    @PostMapping("/forecast")
    MlForecastResponse getForecast(@RequestBody MlForecastRequest request);

    @PostMapping("/health")
    String healthCheck();
}