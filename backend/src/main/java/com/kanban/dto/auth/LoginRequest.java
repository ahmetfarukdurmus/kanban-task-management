package com.kanban.dto.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for {@code POST /auth/login}.
 *
 * @param username registered username
 * @param password raw password (compared against BCrypt hash)
 */
public record LoginRequest(

        @NotBlank(message = "Username must not be blank")
        String username,

        @NotBlank(message = "Password must not be blank")
        String password
) {}
