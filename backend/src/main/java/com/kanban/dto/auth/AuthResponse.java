package com.kanban.dto.auth;

/**
 * Unified response for both register and login.
 * The {@code token} field contains the signed JWT the client
 * should include in subsequent requests as {@code Authorization: Bearer <token>}.
 *
 * @param token    signed JWT Bearer token
 * @param id       user's database id
 * @param username username of the authenticated user
 * @param email    e-mail of the authenticated user
 */
public record AuthResponse(
        String token,
        Long   id,
        String username,
        String email
) {}
