package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.slivkiai.flowdetect.domain.entity.EventEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<EventEntity, Long> {

    @Query("SELECT e FROM EventEntity e WHERE e.city.id = :cityId AND e.eventDate = :date")
    Optional<EventEntity> findByCityAndDate(@Param("cityId") Long cityId, @Param("date") LocalDate date);

    @Query("SELECT e FROM EventEntity e WHERE e.city.id = :cityId AND e.eventDate BETWEEN :startDate AND :endDate")
    List<EventEntity> findByCityAndDateRange(@Param("cityId") Long cityId,
                                             @Param("startDate") LocalDate startDate,
                                             @Param("endDate") LocalDate endDate);
}
