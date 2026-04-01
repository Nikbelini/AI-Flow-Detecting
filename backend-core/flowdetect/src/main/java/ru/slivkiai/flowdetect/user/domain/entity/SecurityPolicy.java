package ru.slivkiai.flowdetect.user.domain.entity;

import jakarta.persistence.*;

import lombok.*;

@Entity
@Table(name = "user_security_policy")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityPolicy {
    
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "security_policy_sequence")
    @SequenceGenerator(name = "security_policy_sequence", sequenceName = "sequence_security_policy", allocationSize = 1)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // ===== POLICIES =====
    private int passwordExpirationDays;

    private int maxFailedAttempts;
    
    private int lockDurationSeconds;
}
