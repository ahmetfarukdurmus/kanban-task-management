package com.kanban.dto.user;

/**
 * Minimal user projection used for the assignee selection dropdown and online active team widget.
 *
 * @param id               user's database id
 * @param username         display name
 * @param email            e-mail address
 * @param organizationId   id of user's organization
 * @param organizationName name of user's organization
 */
public record UserSummaryDto(
        Long   id,
        String username,
        String email,
        Long   organizationId,
        String organizationName
) {
    public UserSummaryDto(Long id, String username, String email) {
        this(id, username, email, null, null);
    }
}
