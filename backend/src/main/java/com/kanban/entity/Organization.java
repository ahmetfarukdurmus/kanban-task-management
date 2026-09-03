package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Multi-tenant organization / department entity.
 * Users and Boards belong to an Organization.
 * Users can have ManyToMany memberships with Organizations.
 */
@Entity
@Table(name = "organizations", uniqueConstraints = {
        @UniqueConstraint(name = "uk_organizations_name", columnNames = "name")
})
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 255)
    private String description;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    /** Members belonging to this organization. */
    @JsonIgnore
    @ManyToMany(mappedBy = "organizations", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<User> members = new HashSet<>();
}
