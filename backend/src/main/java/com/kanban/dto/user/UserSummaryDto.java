package com.kanban.dto.user;

import java.time.Instant;

/**
 * User projection used for assignee selection, team members modal, and active team widget.
 *
 * @param id               user's database id
 * @param username         display name
 * @param email            e-mail address
 * @param role             role name (e.g. ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_USER)
 * @param organizationId   id of user's organization
 * @param organizationName name of user's organization
 * @param createdAt        creation timestamp
 */
public record UserSummaryDto(
        Long    id,
        String  username,
        String  email,
        String  role,
        Long    organizationId,
        String  organizationName,
        Instant createdAt
) {
    public UserSummaryDto(Long id, String username, String email) {
        this(id, username, email, "ROLE_USER", null, null, null);
    }

    public UserSummaryDto(Long id, String username, String email, Long organizationId, String organizationName) {
        this(id, username, email, "ROLE_USER", organizationId, organizationName, null);
    }
}
