package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
import java.util.stream.Collectors;

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
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "boards", "authorities"})
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(nullable = false, length = 120)
    private String email;

    /** Stored as BCrypt hash – never plaintext. */
    @JsonIgnore
    @Column(nullable = false)
    private String password;

    /**
     * RBAC role – stored as a string enum value (ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN).
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
    @JsonIgnore
    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Board> boards;

    // ── Helper methods for organization names / IDs ──

    public String getPrimaryOrganizationName() {
        if (organizations == null || organizations.isEmpty()) {
            return null;
        }
        return organizations.stream()
                .map(Organization::getName)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.joining(", "));
    }

    public Long getPrimaryOrganizationId() {
        if (organizations == null || organizations.isEmpty()) {
            return null;
        }
        return organizations.iterator().next().getId();
    }

    // ─── UserDetails contract ────────────────────────────────────────────

    /**
     * Returns granted authorities for Spring Security based solely on user.role.
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (role == Role.ROLE_SUPER_ADMIN) {
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
