package com.kanban.entity;

/**
 * Application-level roles used for RBAC.
 *
 * <ul>
 *   <li>{@link #ROLE_USER}        – Standard team member.</li>
 *   <li>{@link #ROLE_ADMIN}       – Department Administrator.</li>
 *   <li>{@link #ROLE_SUPER_ADMIN} – Super Administrator with company-wide authority.</li>
 * </ul>
 */
public enum Role {
    ROLE_USER,
    ROLE_ADMIN,
    ROLE_SUPER_ADMIN
}
