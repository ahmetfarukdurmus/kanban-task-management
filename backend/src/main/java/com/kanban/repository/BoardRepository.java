package com.kanban.repository;

import com.kanban.entity.Board;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BoardRepository extends JpaRepository<Board, Long> {

    /** Returns only boards owned by the given user – multi-tenancy guard. */
    List<Board> findAllByOwnerId(Long ownerId);

    /** Ownership check: only fetch if the board belongs to this user. */
    Optional<Board> findByIdAndOwnerId(Long id, Long ownerId);
}
