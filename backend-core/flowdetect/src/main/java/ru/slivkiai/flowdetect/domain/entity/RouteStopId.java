package ru.slivkiai.flowdetect.domain.entity;

public class RouteStopId implements java.io.Serializable {
    private Long route;
    private Long stop;

    // Конструкторы, equals, hashCode
    public RouteStopId() {
    }

    public RouteStopId(Long routeId, Long stopId) {
        this.route = routeId;
        this.stop = stopId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RouteStopId that = (RouteStopId) o;
        return route.equals(that.route) && stop.equals(that.stop);
    }

    @Override
    public int hashCode() {
        return 31 * route.hashCode() + stop.hashCode();
    }
}
