package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Application user.
 * Implements {@link UserDetails} so Spring Security can consume it directly.
 * Supports multi-department memberships via {@code user_organizations} join table.
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
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private Role role = Role.ROLE_USER;

    /**
     * Organizations / Departments this user belongs to (ManyToMany).
     */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_organizations",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "organization_id")
    )
    @Builder.Default
    private Set<Organization> organizations = new HashSet<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    // ── Boards owned by this user (cascade all lifecycle operations) ──
    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Board> boards;

    // ── Helper methods for organization names / IDs ──

    public String getPrimaryOrganizationName() {
        if (organizations == null || organizations.isEmpty()) {
            return null;
        }
        return organizations.stream()
                .map(Organization::getName)
                .reduce((a, b) -> a + ", " + b)
                .orElse(null);
    }

    public Long getPrimaryOrganizationId() {
        if (organizations == null || organizations.isEmpty()) {
            return null;
        }
        return organizations.iterator().next().getId();
    }

    // ─── UserDetails contract ────────────────────────────────────────────

    /**
     * Returns granted authorities for Spring Security.
     * Super Admins (ROLE_SUPER_ADMIN or ROLE_ADMIN with no organizations) receive both
     * ROLE_ADMIN and ROLE_SUPER_ADMIN authorities.
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (role == Role.ROLE_SUPER_ADMIN || (role == Role.ROLE_ADMIN && (organizations == null || organizations.isEmpty()))) {
            return List.of(
                    new SimpleGrantedAuthority(Role.ROLE_ADMIN.name()),
                    new SimpleGrantedAuthority(Role.ROLE_SUPER_ADMIN.name())
            );
        }
        return List.of(new SimpleGrantedAuthority(role.name()));
    }

    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}
