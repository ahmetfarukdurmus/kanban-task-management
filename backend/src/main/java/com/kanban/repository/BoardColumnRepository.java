package com.kanban.repository;

import com.kanban.entity.BoardColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BoardColumnRepository extends JpaRepository<BoardColumn, Long> {

    List<BoardColumn> findAllByBoardIdOrderByPositionAsc(Long boardId);

    Optional<BoardColumn> findByIdAndBoardId(Long id, Long boardId);

    /** Count columns in a board to compute the next position on insert. */
    int countByBoardId(Long boardId);

    /**
     * Shift column positions up (decrement) for a given range.
     * Used when a column is deleted or moved left.
     */
    @Modifying
    @Query("""
           UPDATE BoardColumn c
           SET    c.position = c.position - 1
           WHERE  c.board.id = :boardId
             AND  c.position > :fromPos
             AND  c.position <= :toPos
           """)
    void shiftPositionsLeft(@Param("boardId") Long boardId,
                            @Param("fromPos") int fromPos,
                            @Param("toPos")   int toPos);

    /**
     * Shift column positions down (increment) for a given range.
     * Used when a column is moved right.
     */
    @Modifying
    @Query("""
           UPDATE BoardColumn c
           SET    c.position = c.position + 1
           WHERE  c.board.id = :boardId
             AND  c.position >= :fromPos
             AND  c.position < :toPos
           """)
    void shiftPositionsRight(@Param("boardId") Long boardId,
                             @Param("fromPos") int fromPos,
                             @Param("toPos")   int toPos);
}
