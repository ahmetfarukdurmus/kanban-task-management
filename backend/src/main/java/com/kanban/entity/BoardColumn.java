package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * A column inside a {@link Board} (e.g. TODO, IN PROGRESS, DONE).
 * {@code position} drives the display order; reordering updates this field.
 */
@Entity
@Table(name = "board_columns")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class BoardColumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String title;

    /**
     * Zero-based display order within its board.
     * Reordering a column updates this value for affected columns.
     */
    @Column(nullable = false)
    private Integer position;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "board_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_columns_board"))
    private Board board;

    /** Tasks inside this column, ordered by {@code position}. */
    @OneToMany(mappedBy = "column",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<Task> tasks = new ArrayList<>();
}
