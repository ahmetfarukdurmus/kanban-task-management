package com.kanban.entity;

/**
 * Application-level roles used for RBAC.
 *
 * <ul>
 *   <li>{@link #ROLE_USER}  – Standard user; can read boards/tasks and move tasks (DnD).</li>
 *   <li>{@link #ROLE_ADMIN} – Administrator; can also create/delete tasks and add columns.</li>
 * </ul>
 *
 * The {@code ROLE_} prefix is the Spring Security convention so that
 * {@code hasRole("ADMIN")} automatically maps to the authority {@code "ROLE_ADMIN"}.
 */
public enum Role {
    ROLE_USER,
    ROLE_ADMIN
}
