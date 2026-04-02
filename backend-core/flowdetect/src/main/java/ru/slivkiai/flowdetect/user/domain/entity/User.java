package ru.slivkiai.flowdetect.user.domain.entity;

import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "user_sequence")
    @SequenceGenerator(name = "user_sequence", sequenceName = "sequence_user", allocationSize = 1)
    private long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Role role;

    @Column(nullable = false)
    private boolean accountLocked;

    @Column(nullable = false)
    private boolean emailConfirmed;

    @Column(nullable = false)
    private int failedAttempts;
    private LocalDateTime lockUntil;

    // === 2FA === //
    @Column(nullable = false)
    private boolean twoFactorEnabled;
    private String twoFactorSecret;

    private LocalDateTime lastPasswordChangeAt;

    // === AUDIT ===
    private LocalDateTime lastLoginAt;

    public boolean isLocked() {
        return accountLocked || 
            (lockUntil != null && lockUntil.isAfter(LocalDateTime.now()));
    }
}
