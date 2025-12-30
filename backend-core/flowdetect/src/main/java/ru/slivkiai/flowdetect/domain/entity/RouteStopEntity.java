package ru.slivkiai.flowdetect.domain.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "route_stops")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(RouteStopId.class)
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
    private String direction; // 'A' или 'B' для двунаправленных маршрутов

    @Column(name = "travel_time_to_next")
    private Integer travelTimeToNext; // время до следующей остановки в минутах

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}

