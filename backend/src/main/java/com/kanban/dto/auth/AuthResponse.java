package com.kanban.dto.auth;

/**
 * Unified response for both register and login.
 */
public record AuthResponse(
        String token,
        Long   id,
        String username,
        String email,
        String role,
        Long   organizationId,
        String organizationName
) {
    public AuthResponse(String token, Long id, String username, String email, String role) {
        this(token, id, username, email, role, null, null);
    }
}
