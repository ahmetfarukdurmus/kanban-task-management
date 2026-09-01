package com.kanban.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for {@code POST /auth/register}.
 */
public record RegisterRequest(

        @NotBlank
        @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
        String username,

        @NotBlank
        @Email(message = "Must be a valid e-mail address")
        String email,

        @NotBlank
        @Size(min = 6, max = 120, message = "Password must be between 6 and 120 characters")
        String password,

        Long organizationId,

        String role
) {
    public RegisterRequest(String username, String email, String password, Long organizationId) {
        this(username, email, password, organizationId, "ROLE_USER");
    }
}
