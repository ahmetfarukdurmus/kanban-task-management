package com.kanban.repository;

import com.kanban.entity.Board;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BoardRepository extends JpaRepository<Board, Long> {

    /** Returns all boards ordered by creation time descending. */
    List<Board> findAllByOrderByCreatedAtDesc();

    /** Returns only boards belonging to the specified organization. */
    List<Board> findAllByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /**
     * Returns boards accessible to the user:
     * 1. Boards belonging to any of the user's organizations.
     * 2. AND/OR boards where the user is assigned to at least one task (guest access).
     */
    @Query("SELECT DISTINCT b FROM Board b " +
           "WHERE (b.organization.id IN :userOrgIds) " +
           "   OR EXISTS (SELECT t FROM Task t WHERE t.column.board.id = b.id AND (t.assignedUser.id = :userId OR t.assignee = :username)) " +
           "ORDER BY b.createdAt DESC")
    List<Board> findAccessibleBoardsForUser(
            @Param("userOrgIds") Collection<Long> userOrgIds,
            @Param("userId") Long userId,
            @Param("username") String username);

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
