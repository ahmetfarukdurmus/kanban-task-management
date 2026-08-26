package com.kanban.security;

import com.kanban.entity.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Thin helper that extracts the currently authenticated {@link User}
 * from the Spring Security context.
 *
 * <p>Since {@link User} implements {@link org.springframework.security.core.userdetails.UserDetails}
 * and is stored directly as the principal by {@link jwt.AuthTokenFilter},
 * no additional database call is needed.</p>
 */
@Component
public class SecurityUtils {

    /**
     * Returns the authenticated user for the current request.
     *
     * @throws IllegalStateException if no authenticated principal is present
     */
    public User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && auth.getPrincipal() instanceof User user) {
            return user;
        }
        throw new IllegalStateException("No authenticated user found in the security context");
    }
}
