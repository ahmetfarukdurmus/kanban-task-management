package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A Kanban board belonging to an {@link Organization} and owned by a {@link User}.
 * Data isolation: queries filter by organization.
 */
@Entity
@Table(name = "boards")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Board {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private BoardType boardType = BoardType.STANDARD;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    /** Owner of this board. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_boards_owner"))
    private User owner;

    /** Organization / Team this board belongs to – multi-tenancy key. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id",
                foreignKey = @ForeignKey(name = "fk_boards_organization"))
    private Organization organization;

    /** Ordered list of columns on this board. */
    @OneToMany(mappedBy = "board",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<BoardColumn> columns = new ArrayList<>();
}
