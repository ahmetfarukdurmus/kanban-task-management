package com.kanban.dto.user;

import java.time.Instant;
import java.util.List;

/**
 * User response DTO supporting multi-department organization names and ids.
 */
public record UserResponse(
        Long         id,
        String       username,
        String       email,
        String       role,
        Long         organizationId,
        String       organizationName,
        List<Long>   organizationIds,
        List<String> organizationNames,
        Instant      createdAt
) {
    public UserResponse(Long id, String username, String email, String role, Long organizationId, String organizationName, Instant createdAt) {
        this(id, username, email, role, organizationId, organizationName,
                organizationId != null ? List.of(organizationId) : List.of(),
                organizationName != null ? List.of(organizationName) : List.of(),
                createdAt);
    }
}
