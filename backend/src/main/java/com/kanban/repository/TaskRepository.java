package com.kanban.repository;

import com.kanban.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findAllByColumnIdOrderByPositionAsc(Long columnId);

    Optional<Task> findByIdAndColumnId(Long id, Long columnId);

    /** Count tasks in a column to compute next insert position. */
    int countByColumnId(Long columnId);

    /**
     * Shift task positions left (decrement) when a task is removed
     * or moved out of a column.
     */
    @Modifying
    @Query("""
           UPDATE Task t
           SET    t.position = t.position - 1
           WHERE  t.column.id = :columnId
             AND  t.position > :fromPos
             AND  t.position <= :toPos
           """)
    void shiftPositionsLeft(@Param("columnId") Long columnId,
                            @Param("fromPos")  int fromPos,
                            @Param("toPos")    int toPos);

    /**
     * Shift task positions right (increment) when a task is inserted
     * into a column at a given index.
     */
    @Modifying
    @Query("""
           UPDATE Task t
           SET    t.position = t.position + 1
           WHERE  t.column.id = :columnId
             AND  t.position >= :fromPos
             AND  t.position < :toPos
           """)
    void shiftPositionsRight(@Param("columnId") Long columnId,
                             @Param("fromPos")  int fromPos,
                             @Param("toPos")    int toPos);
}
