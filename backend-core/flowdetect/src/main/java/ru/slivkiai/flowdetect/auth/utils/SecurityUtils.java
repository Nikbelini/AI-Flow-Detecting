package ru.slivkiai.flowdetect.auth.utils;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;

@Component
public class SecurityUtils {
    
    public static long getCurrentUserId() {
        
        var context = SecurityContextHolder.getContext();

        if (context == null || context.getAuthentication() == null) {
            throw new IllegalStateException("No authentication");
        }

        Object principal = context.getAuthentication().getPrincipal();

        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Invalid principal type");
        }

        return userDetails.getId();
    }
}
