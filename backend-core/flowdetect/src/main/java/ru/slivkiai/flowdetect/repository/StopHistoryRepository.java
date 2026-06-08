package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StopHistoryRepository extends JpaRepository<StopHistoryEntity, Long> {
    List<StopHistoryEntity> findTop2ByAddressOrderByDatetimeDesc(String address);

    List<StopHistoryEntity> findByAddressAndDatetimeBetween(String address, LocalDateTime startTime, LocalDateTime endTime);

    @Query("SELECT sh FROM StopHistoryEntity sh WHERE sh.address = :address AND sh.datetime >= CURRENT_TIMESTAMP - 24 HOUR ORDER BY sh.datetime DESC")
    List<StopHistoryEntity> findLast24HoursByAddress(@Param("address") String address);
}
