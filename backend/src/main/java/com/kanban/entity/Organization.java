package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Multi-tenant organization / team entity.
 * Users and Boards belong to an Organization.
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
}
