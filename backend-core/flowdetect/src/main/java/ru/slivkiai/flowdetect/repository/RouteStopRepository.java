package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.slivkiai.flowdetect.domain.entity.RouteStopEntity;
import ru.slivkiai.flowdetect.domain.entity.RouteStopId;

import java.util.List;

public interface RouteStopRepository extends JpaRepository<RouteStopEntity, RouteStopId> {
    List<RouteStopEntity> findByRouteIdOrderByOrderInRoute(Long routeId);
    List<RouteStopEntity> findByRouteIdAndDirectionOrderByOrderInRoute(Long routeId, String direction);
    List<RouteStopEntity> findByStopId(Long stopId);
    void deleteByRouteId(Long routeId);
}
