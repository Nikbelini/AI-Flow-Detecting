package ru.slivkiai.flowdetect.user.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;

public interface SecurityPolicyRepository extends JpaRepository<SecurityPolicy, Long> {
    Optional<SecurityPolicy> findByUserId(Long userId);
    
}
