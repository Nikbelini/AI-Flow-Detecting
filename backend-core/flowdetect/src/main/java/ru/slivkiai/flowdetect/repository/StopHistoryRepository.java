package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StopHistoryRepository extends JpaRepository<StopHistoryEntity, Long> {
    List<StopHistoryEntity> findTop2ByAddressOrderByDatetimeDesc(String address);

    List<StopHistoryEntity> findByAddressAndDatetimeBetween(String address, LocalDateTime startTime, LocalDateTime endTime);
}
