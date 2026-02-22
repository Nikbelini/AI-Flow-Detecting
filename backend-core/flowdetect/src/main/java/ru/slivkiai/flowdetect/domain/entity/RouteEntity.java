package ru.slivkiai.flowdetect.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "routes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RouteEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String number;

    @Column(length = 128)
    private String name;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "transport_type", nullable = false, columnDefinition = "transport_type")
    private TransportType transportType;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "city_id", nullable = false)
    private CityEntity city;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<RouteStopEntity> routeStops = new ArrayList<>();

    @Column(name = "direction_a_name", length = 128)
    private String directionAName;

    @Column(name = "direction_b_name", length = 128)
    private String directionBName;

    @Column(name = "interval_minutes")
    private Integer intervalMinutes;

    @Column(name = "operating_hours", length = 100)
    private String operatingHours;

    // Вспомогательный метод для добавления остановки с порядком
    public void addStop(StopEntity stop, Integer order, String direction) {
        RouteStopEntity routeStop = RouteStopEntity.builder()
                .route(this)
                .stop(stop)
                .orderInRoute(order)
                .direction(direction)
                .build();
        routeStops.add(routeStop);
    }

    // Вспомогательный метод для получения остановок в правильном порядке
    public List<StopEntity> getStopsInOrder(String direction) {
        return routeStops.stream()
                .filter(rs -> direction == null || direction.equals(rs.getDirection()))
                .sorted((rs1, rs2) -> rs1.getOrderInRoute().compareTo(rs2.getOrderInRoute()))
                .map(RouteStopEntity::getStop)
                .toList();
    }
}