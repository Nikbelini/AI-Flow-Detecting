package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.slivkiai.flowdetect.domain.entity.WeatherDataEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WeatherDataRepository extends JpaRepository<WeatherDataEntity, Long> {

    @Query("SELECT w FROM WeatherDataEntity w WHERE w.city.id = :cityId AND w.datetime >= :startTime ORDER BY w.datetime DESC")
    List<WeatherDataEntity> findRecentByCityId(@Param("cityId") Long cityId, @Param("startTime") LocalDateTime startTime);

    /**
     * Найти запись о погоде по точному времени
     * @param datetime точное время для поиска
     * @return Optional с записью о погоде, если найдена
     */
    @Query("SELECT w FROM WeatherDataEntity w WHERE w.datetime = :datetime")
    Optional<WeatherDataEntity> findByDateTime(@Param("datetime") LocalDateTime datetime);

    /**
     * Найти записи о погоде по диапазону времени
     * @param start начало диапазона
     * @param end конец диапазона
     * @return список записей о погоде в указанном диапазоне
     */
    @Query("SELECT w FROM WeatherDataEntity w WHERE w.datetime BETWEEN :start AND :end ORDER BY w.datetime")
    List<WeatherDataEntity> findByDateTimeBetween(@Param("start") LocalDateTime start,
                                                  @Param("end") LocalDateTime end);

    /**
     * Найти последнюю запись о погоде для города
     * @param cityId ID города
     * @return Optional с последней записью о погоде
     */
    @Query("SELECT w FROM WeatherDataEntity w WHERE w.city.id = :cityId ORDER BY w.datetime DESC LIMIT 1")
    Optional<WeatherDataEntity> findLatestByCityId(@Param("cityId") Long cityId);
}