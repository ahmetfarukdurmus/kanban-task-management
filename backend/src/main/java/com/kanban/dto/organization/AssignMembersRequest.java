package com.kanban.dto.organization;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Request payload for assigning existing users to an organization.
 */
public record AssignMembersRequest(
        @NotEmpty(message = "En az bir kullanıcı seçilmelidir")
        List<Long> userIds
) {}
