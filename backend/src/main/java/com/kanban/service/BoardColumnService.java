package com.kanban.service;

import com.kanban.dto.column.ColumnRequest;
import com.kanban.dto.column.ColumnResponse;
import com.kanban.dto.task.TaskResponse;
import com.kanban.entity.Board;
import com.kanban.entity.BoardColumn;
import com.kanban.entity.Task;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.BoardColumnRepository;
import com.kanban.repository.BoardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Business logic for BoardColumn CRUD and column reordering.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BoardColumnService {

    private final BoardColumnRepository columnRepository;
    private final BoardRepository       boardRepository;

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns all columns for a board (ordered by position) with their tasks.
     */
    @Transactional(readOnly = true)
    public List<ColumnResponse> getColumns(Long boardId) {
        requireBoard(boardId);

        return columnRepository.findAllByBoardIdOrderByPositionAsc(boardId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Returns a single column with its tasks.
     */
    @Transactional(readOnly = true)
    public ColumnResponse getColumn(Long boardId, Long columnId) {
        requireBoard(boardId);
        return toResponse(requireColumn(boardId, columnId));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Adds a new column at the end of the board (next available position).
     */
    public ColumnResponse createColumn(Long boardId, ColumnRequest request) {
        Board board = requireBoard(boardId);

        int nextPosition = columnRepository.countByBoardId(boardId);

        BoardColumn column = BoardColumn.builder()
                .title(request.title())
                .position(nextPosition)
                .board(board)
                .tasks(new ArrayList<>())
                .build();

        BoardColumn saved = columnRepository.save(column);
        columnRepository.flush();
        return toResponse(saved);
    }

    /**
     * Renames an existing column.
     */
    public ColumnResponse updateColumn(Long boardId, Long columnId, ColumnRequest request) {
        requireBoard(boardId);

        BoardColumn column = requireColumn(boardId, columnId);
        column.setTitle(request.title());

        BoardColumn saved = columnRepository.save(column);
        columnRepository.flush();
        return toResponse(saved);
    }

    /**
     * Deletes a column (and all its tasks, via cascade) then
     * closes the positional gap left by the deletion.
     */
    public void deleteColumn(Long boardId, Long columnId) {
        requireBoard(boardId);

        BoardColumn column = requireColumn(boardId, columnId);
        int deletedPos = column.getPosition();

        columnRepository.delete(column);
        columnRepository.flush();   // ensure DELETE is sent before the UPDATE below

        // Close the gap: shift all columns after deletedPos left by 1
        columnRepository.shiftPositionsLeft(boardId, deletedPos, Integer.MAX_VALUE);
        columnRepository.flush();
    }

    /**
     * Moves a column to {@code newPosition} within its board.
     */
    public ColumnResponse reorderColumn(Long boardId, Long columnId, int newPosition) {
        requireBoard(boardId);

        BoardColumn column  = requireColumn(boardId, columnId);
        int         srcPos  = column.getPosition();

        int total    = columnRepository.countByBoardId(boardId);
        int clampedDst = Math.min(newPosition, total - 1);

        if (srcPos == clampedDst) {
            return toResponse(column);  // no-op
        }

        if (clampedDst > srcPos) {
            // Moving right: shift intermediate columns left by 1
            columnRepository.shiftPositionsLeft(boardId, srcPos, clampedDst);
        } else {
            // Moving left: shift intermediate columns right by 1
            columnRepository.shiftPositionsRight(boardId, clampedDst, srcPos);
        }

        column.setPosition(clampedDst);
        BoardColumn saved = columnRepository.save(column);
        columnRepository.flush();
        return toResponse(saved);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private Board requireBoard(Long boardId) {
        return boardRepository.findById(boardId)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", boardId));
    }

    private BoardColumn requireColumn(Long boardId, Long columnId) {
        return columnRepository.findByIdAndBoardId(columnId, boardId)
                .orElseThrow(() -> ResourceNotFoundException.of("Column", columnId));
    }

    private ColumnResponse toResponse(BoardColumn col) {
        List<TaskResponse> tasks = col.getTasks() != null
                ? col.getTasks().stream()
                        .sorted(java.util.Comparator.comparingInt(Task::getPosition))
                        .map(this::toTaskResponse)
                        .toList()
                : List.of();

        return new ColumnResponse(
                col.getId(),
                col.getTitle(),
                col.getPosition(),
                col.getBoard().getId(),
                tasks);
    }

    private TaskResponse toTaskResponse(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority().name(),
                task.getDueDate(),
                task.getAssignee(),
                task.getPosition(),
                task.getColumn().getId());
    }
}
