package com.kanban.dto.user;

/**
 * Minimal user projection used for the assignee selection dropdown.
 *
 * @param id       user's database id
 * @param username display name
 * @param email    e-mail address
 */
public record UserSummaryDto(
        Long   id,
        String username,
        String email
) {}
