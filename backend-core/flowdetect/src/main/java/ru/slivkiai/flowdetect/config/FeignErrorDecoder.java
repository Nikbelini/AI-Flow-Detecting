package ru.slivkiai.flowdetect.config;

import feign.Response;
import feign.codec.ErrorDecoder;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class FeignErrorDecoder implements ErrorDecoder {

    @Override
    public Exception decode(String methodKey, Response response) {
        log.error("Feign client error: methodKey={}, status={}, reason={}",
                methodKey, response.status(), response.reason());

        return new RuntimeException(
                String.format("ML service error: %s - %s", response.status(), response.reason())
        );
    }
}