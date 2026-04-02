package ru.slivkiai.flowdetect.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.dto.PolicyUpdate;
import ru.slivkiai.flowdetect.user.dto.SecurityPolicyDto;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;

@RestController
@RequestMapping("/api/user/policy")
@RequiredArgsConstructor
public class SecurityPolicyController {
    
private final SecurityPolicyService securityPolicyService;

    @GetMapping
    public ResponseEntity<SecurityPolicyDto> getMyPolicy(
            @AuthenticationPrincipal CustomUserDetails user) {
        SecurityPolicy policy = securityPolicyService.getPolicy(user.getId());
        return ResponseEntity.ok(toDto(policy));
    }

    @PutMapping
    public ResponseEntity<SecurityPolicyDto> updateMyPolicy(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody @Valid PolicyUpdate dto) {
        securityPolicyService.updateMyPolicy(user.getId(), dto);
        SecurityPolicy updated = securityPolicyService.getPolicy(user.getId());
        return ResponseEntity.ok(toDto(updated));
    }

    private SecurityPolicyDto toDto(SecurityPolicy policy) {
        return new SecurityPolicyDto(
                policy.getId(),
                policy.getMaxFailedAttempts(),
                policy.getLockDurationSeconds(),
                policy.getPasswordExpirationDays(),
                policy.getUser().getId()
        );
    }
}
