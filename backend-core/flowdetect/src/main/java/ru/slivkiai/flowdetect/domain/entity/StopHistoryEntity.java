package ru.slivkiai.flowdetect.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stops_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StopHistoryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "city_id", nullable = false)
    private CityEntity city;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stop_id", nullable = true)
    private StopEntity stop;

    @Column(nullable = false, length = 32)
    private String address;

    @Column(name = "count", nullable = false)
    private Integer count;

    @Column(nullable = false)
    private Integer velocity;

    @Column(nullable = false)
    private Integer load;

    @Column(precision = 9, scale = 6)
    private BigDecimal lat;

    @Column(precision = 9, scale = 6)
    private BigDecimal lng;

    @Column(nullable = false, updatable = false)
    private LocalDateTime datetime;
}
