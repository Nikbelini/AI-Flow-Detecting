package ru.slivkiai.flowdetect.user.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.user.domain.entity.SecurityPolicy;
import ru.slivkiai.flowdetect.user.dto.UserUpdatePolicy;
import ru.slivkiai.flowdetect.user.service.SecurityPolicyService;

@RestController
@RequestMapping("/api/admin/policy")
@RequiredArgsConstructor
public class AdminPolicyController {
    
    private final SecurityPolicyService securityPolicyService;

    @PutMapping("/{userId}")
    public void updatePolicy(@PathVariable long userId, @RequestBody UserUpdatePolicy dto) {
        securityPolicyService.updatePolicyAsAdmin(userId, dto);
    }

    @GetMapping("/{userId}")
    public SecurityPolicy getPolicy(@PathVariable long userId) {
        return securityPolicyService.getPolicy(userId);
    }
}
