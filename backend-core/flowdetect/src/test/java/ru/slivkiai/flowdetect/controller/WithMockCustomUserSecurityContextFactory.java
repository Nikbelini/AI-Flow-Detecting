package ru.slivkiai.flowdetect.controller;


import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithSecurityContextFactory;
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;

import java.util.List;

public class WithMockCustomUserSecurityContextFactory
        implements WithSecurityContextFactory<WithMockCustomUser> {

    @Override
    public SecurityContext createSecurityContext(WithMockCustomUser annotation) {
        User user = User.builder()
                .id(annotation.id())
                .email(annotation.username())
                .role(Role.valueOf(annotation.role()))
                .build();

        CustomUserDetails principal = new CustomUserDetails(user);

        var auth = new UsernamePasswordAuthenticationToken(
                principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + annotation.role())));

        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        return ctx;
    }
}
