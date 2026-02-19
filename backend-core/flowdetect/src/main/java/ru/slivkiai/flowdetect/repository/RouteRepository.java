package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.slivkiai.flowdetect.domain.entity.RouteEntity;
import ru.slivkiai.flowdetect.domain.entity.TransportType;

import java.util.List;
import java.util.Optional;

public interface RouteRepository extends JpaRepository<RouteEntity, Long> {
    List<RouteEntity> findByCityIdAndTransportType(Long cityId, TransportType transportType);
    List<RouteEntity> findByCityIdAndIsActiveTrue(Long cityId);

    @Query("SELECT DISTINCT r FROM RouteEntity r " +
            "JOIN r.routeStops rs " +
            "WHERE rs.stop.id = :stopId")
    List<RouteEntity> findByStopId(@Param("stopId") Long stopId);

    @Query(value = "SELECT CASE WHEN COUNT(*) > 0 THEN true ELSE false END " +
            "FROM routes r " +
            "WHERE r.number = :number " +
            "AND r.city_id = :cityId " +
            "AND r.transport_type = CAST(:transportType AS transport_type)", nativeQuery = true)
    boolean existsByNumberAndCityIdAndTransportType(
            @Param("number") String number,
            @Param("cityId") Long cityId,
            @Param("transportType") String transportType
    );

    @Query("SELECT r FROM RouteEntity r " +
            "WHERE r.city.id = :cityId " +
            "AND LOWER(r.number) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    List<RouteEntity> searchInCity(@Param("cityId") Long cityId, @Param("search") String search);
}

