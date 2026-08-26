package com.kanban.service;

import com.kanban.dto.column.ColumnRequest;
import com.kanban.dto.column.ColumnResponse;
import com.kanban.dto.task.TaskResponse;
import com.kanban.entity.Board;
import com.kanban.entity.BoardColumn;
import com.kanban.entity.Task;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.BoardColumnRepository;
import com.kanban.repository.BoardRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Business logic for BoardColumn CRUD and column reordering.
 *
 * <h3>Position Algorithm (Reorder)</h3>
 * <p>Positions are zero-based integers stored per-board.  When a column
 * moves from index {@code src} to {@code dst}:</p>
 * <ul>
 *   <li>{@code dst > src} → columns in {@code (src, dst]} shift <em>left</em> (−1)</li>
 *   <li>{@code dst < src} → columns in {@code [dst, src)} shift <em>right</em> (+1)</li>
 * </ul>
 * <p>Only O(|dst−src|) rows are updated — no full-table rewrite.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BoardColumnService {

    private final BoardColumnRepository columnRepository;
    private final BoardRepository       boardRepository;
    private final SecurityUtils         securityUtils;

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns all columns for a board (ordered by position) with their tasks.
     */
    @Transactional(readOnly = true)
    public List<ColumnResponse> getColumns(Long boardId) {
        User user = securityUtils.getCurrentUser();
        requireBoardOwned(boardId, user.getId());

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
        User user = securityUtils.getCurrentUser();
        requireBoardOwned(boardId, user.getId());
        return toResponse(requireColumn(boardId, columnId));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Adds a new column at the end of the board (next available position).
     */
    public ColumnResponse createColumn(Long boardId, ColumnRequest request) {
        User  user  = securityUtils.getCurrentUser();
        Board board = requireBoardOwned(boardId, user.getId());

        int nextPosition = columnRepository.countByBoardId(boardId);

        BoardColumn column = BoardColumn.builder()
                .title(request.title())
                .position(nextPosition)
                .board(board)
                .build();

        return toResponse(columnRepository.save(column));
    }

    /**
     * Renames an existing column.
     */
    public ColumnResponse updateColumn(Long boardId, Long columnId, ColumnRequest request) {
        User user = securityUtils.getCurrentUser();
        requireBoardOwned(boardId, user.getId());

        BoardColumn column = requireColumn(boardId, columnId);
        column.setTitle(request.title());

        return toResponse(columnRepository.save(column));
    }

    /**
     * Deletes a column (and all its tasks, via cascade) then
     * closes the positional gap left by the deletion.
     */
    public void deleteColumn(Long boardId, Long columnId) {
        User user = securityUtils.getCurrentUser();
        requireBoardOwned(boardId, user.getId());

        BoardColumn column = requireColumn(boardId, columnId);
        int deletedPos = column.getPosition();

        columnRepository.delete(column);
        columnRepository.flush();   // ensure DELETE is sent before the UPDATE below

        // Close the gap: shift all columns after deletedPos left by 1
        columnRepository.shiftPositionsLeft(boardId, deletedPos, Integer.MAX_VALUE);
    }

    /**
     * Moves a column to {@code newPosition} within its board.
     *
     * <p>The target position is clamped to {@code [0, columnCount − 1]}.</p>
     *
     * @param boardId    owning board
     * @param columnId   column to move
     * @param newPosition zero-based target index
     */
    public ColumnResponse reorderColumn(Long boardId, Long columnId, int newPosition) {
        User user = securityUtils.getCurrentUser();
        requireBoardOwned(boardId, user.getId());

        BoardColumn column  = requireColumn(boardId, columnId);
        int         srcPos  = column.getPosition();

        // Clamp: max valid index is (total − 1)
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
        return toResponse(columnRepository.save(column));
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private Board requireBoardOwned(Long boardId, Long ownerId) {
        return boardRepository.findByIdAndOwnerId(boardId, ownerId)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", boardId));
    }

    private BoardColumn requireColumn(Long boardId, Long columnId) {
        return columnRepository.findByIdAndBoardId(columnId, boardId)
                .orElseThrow(() -> ResourceNotFoundException.of("Column", columnId));
    }

    private ColumnResponse toResponse(BoardColumn col) {
        List<TaskResponse> tasks = col.getTasks().stream()
                .map(this::toTaskResponse)
                .toList();

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
