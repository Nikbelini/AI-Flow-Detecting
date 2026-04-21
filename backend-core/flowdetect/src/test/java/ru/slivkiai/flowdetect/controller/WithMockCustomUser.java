package ru.slivkiai.flowdetect.controller;

import org.springframework.security.test.context.support.WithSecurityContext;

import java.lang.annotation.*;

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@WithSecurityContext(factory = WithMockCustomUserSecurityContextFactory.class)
public @interface WithMockCustomUser {
    long id() default 1L;
    String username() default "test@example.com";
    String role() default "USER";
}
