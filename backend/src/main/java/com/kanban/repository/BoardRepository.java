package com.kanban.repository;

import com.kanban.entity.Board;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BoardRepository extends JpaRepository<Board, Long> {

    /** Returns all boards ordered by creation time descending. */
    List<Board> findAllByOrderByCreatedAtDesc();

    /** Returns only boards belonging to the specified organization. */
    List<Board> findAllByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /** Finds board by id and organization id. */
    Optional<Board> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Returns only boards owned by the given user. */
    List<Board> findAllByOwnerId(Long ownerId);

    /** Finds board by id and owner id. */
    Optional<Board> findByIdAndOwnerId(Long id, Long ownerId);

    /** Eagerly fetches a board along with its columns and tasks. */
    @Query("SELECT DISTINCT b FROM Board b LEFT JOIN FETCH b.columns c LEFT JOIN FETCH c.tasks WHERE b.id = :id")
    Optional<Board> findByIdWithColumnsAndTasks(@Param("id") Long id);
}
