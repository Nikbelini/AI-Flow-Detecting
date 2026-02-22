package ru.slivkiai.flowdetect.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

@Entity
@Table(name = "route_stops")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(RouteStopEntity.RouteStopId.class)  // Внутренний класс для ID
public class RouteStopEntity {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private RouteEntity route;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stop_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private StopEntity stop;

    @Column(name = "order_in_route", nullable = false)
    private Integer orderInRoute;

    @Column(name = "direction", length = 1)
    private String direction;

    @Column(name = "travel_time_to_next")
    private Integer travelTimeToNext;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RouteStopId implements Serializable {
        private Long route;  // должно называться так же, как поле в сущности
        private Long stop;   // должно называться так же, как поле в сущности
    }
}