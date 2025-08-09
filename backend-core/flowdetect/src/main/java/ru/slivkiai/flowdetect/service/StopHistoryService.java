package ru.slivkiai.flowdetect.service;

import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;

public interface StopHistoryService {
    StopHistoryResponse createHistoryRecord(StopHistoryRequest request);
}
