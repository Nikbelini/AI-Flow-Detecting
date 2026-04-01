package ru.slivkiai.flowdetect.user.domain.entity;

import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "device_sessions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceSession {
 
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // session
    private String sessionId;
    private boolean revoked;

    // === Device Info ===
    private String deviceName;
    
    private String userAgent;

    private String os;
    
    private String browser;

    // === Network ===
    private String ip;

    private String country;

    // === Audit ===
    private LocalDateTime createdAt;

    private LocalDateTime lastActiveAt;
}
