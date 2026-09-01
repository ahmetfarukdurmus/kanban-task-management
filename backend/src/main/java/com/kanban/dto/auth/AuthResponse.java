package com.kanban.dto.auth;

/**
 * Unified response for both register and login.
 *
 * <p>The {@code token} field contains the signed JWT the client
 * should include in subsequent requests as {@code Authorization: Bearer <token>}.
 * The {@code role} field enables the frontend to conditionally render
 * admin-only actions (e.g. create task / delete task buttons).</p>
 *
 * @param token    signed JWT Bearer token
 * @param id       user's database id
 * @param username username of the authenticated user
 * @param email    e-mail of the authenticated user
 * @param role     user's RBAC role (e.g. {@code "ROLE_ADMIN"} or {@code "ROLE_USER"})
 */
public record AuthResponse(
        String token,
        Long   id,
        String username,
        String email,
        String role
) {}
