package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.slivkiai.flowdetect.domain.entity.WeatherDataEntity;

import java.time.LocalDateTime;
import java.util.List;

public interface WeatherDataRepository extends JpaRepository<WeatherDataEntity, Long> {

    @Query("SELECT w FROM WeatherDataEntity w WHERE w.city.id = :cityId AND w.datetime >= :startTime ORDER BY w.datetime DESC")
    List<WeatherDataEntity> findRecentByCityId(@Param("cityId") Long cityId, @Param("startTime") LocalDateTime startTime);
}
