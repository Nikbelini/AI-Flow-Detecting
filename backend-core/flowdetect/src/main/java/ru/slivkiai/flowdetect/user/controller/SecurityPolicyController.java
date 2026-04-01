package ru.slivkiai.flowdetect.user.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.dto.UserUpdatePolicy;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;

@RestController
@RequestMapping("/api/user/policy")
@RequiredArgsConstructor
public class SecurityPolicyController {
    
    private final SecurityPolicyService securityPolicyService;

    @PutMapping
    public void updateMyPolicy(@AuthenticationPrincipal CustomUserDetails user,
        @RequestBody UserUpdatePolicy dto) {
        securityPolicyService.updateMyPolicy(user.getId(), dto);
    }

    @GetMapping
    public SecurityPolicy getMyPolicy(@AuthenticationPrincipal CustomUserDetails user) {
        return securityPolicyService.getPolicy(user.getId());
    }
}
