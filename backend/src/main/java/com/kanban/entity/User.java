package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Application user.
 * Implements {@link UserDetails} so Spring Security can consume it directly.
 *
 * <p>The {@link Role} field drives RBAC:
 * <ul>
 *   <li>{@link Role#ROLE_ADMIN} – can create/delete tasks and add columns</li>
 *   <li>{@link Role#ROLE_USER}  – can read, move tasks (DnD), add comments/attachments</li>
 * </ul>
 * New registrations receive {@link Role#ROLE_USER} by default.
 * The first registered user automatically becomes {@link Role#ROLE_ADMIN}.
 * </p>
 */
@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(name = "uk_users_username", columnNames = "username"),
        @UniqueConstraint(name = "uk_users_email",    columnNames = "email")
})
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(nullable = false, length = 120)
    private String email;

    /** Stored as BCrypt hash – never plaintext. */
    @Column(nullable = false)
    private String password;

    /**
     * RBAC role – stored as a string enum value.
     * Defaults to {@link Role#ROLE_USER}; the first registered user is promoted
     * to {@link Role#ROLE_ADMIN} by {@code AuthService}.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.ROLE_USER;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    // ── Boards owned by this user (cascade all lifecycle operations) ──
    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Board> boards;

    // ─── UserDetails contract ────────────────────────────────────────────

    /**
     * Returns the user's single authority derived from their {@link Role}.
     * Spring Security's {@code hasRole("ADMIN")} checks for authority {@code "ROLE_ADMIN"}.
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role.name()));
    }

    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}
