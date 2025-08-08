package ru.slivkiai.flowdetect.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;

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

    @Column(nullable = false, length = 32)
    private String address;

    @Column(name = "count", nullable = false)
    private Integer count;

    @Column(nullable = false)
    private Integer velocity;

    @Column(nullable = false)
    private Integer load;

    @Column(nullable = false, updatable = false)
    private Timestamp datetime;
}