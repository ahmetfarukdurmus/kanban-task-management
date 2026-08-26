package com.kanban.service;

import com.kanban.dto.board.BoardRequest;
import com.kanban.dto.board.BoardResponse;
import com.kanban.dto.column.ColumnResponse;
import com.kanban.dto.task.TaskResponse;
import com.kanban.entity.Board;
import com.kanban.entity.BoardColumn;
import com.kanban.entity.Task;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.BoardRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Business logic for Board CRUD.
 *
 * <h3>Multi-tenancy</h3>
 * <p>Every read/write operation verifies that the target board belongs to the
 * currently authenticated user by filtering on {@code owner_id}.  A board from
 * another user returns a {@link ResourceNotFoundException} (404) rather than
 * a 403, which prevents information leakage about other users' board IDs.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BoardService {

    private final BoardRepository boardRepository;
    private final SecurityUtils   securityUtils;

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns all boards owned by the current user (without columns).
     * Suitable for the board-list / dashboard view.
     */
    @Transactional(readOnly = true)
    public List<BoardResponse> getAllBoards() {
        User user = securityUtils.getCurrentUser();
        return boardRepository.findAllByOwnerId(user.getId())
                .stream()
                .map(b -> toResponse(b, false))
                .toList();
    }

    /**
     * Returns a single board with all its columns and tasks.
     * Suitable for the main Kanban view.
     *
     * @param id board identifier
     * @throws ResourceNotFoundException if not found or not owned by current user
     */
    @Transactional(readOnly = true)
    public BoardResponse getBoard(Long id) {
        User  user  = securityUtils.getCurrentUser();
        Board board = requireOwned(id, user.getId());
        return toResponse(board, true);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Creates a new board for the current user.
     *
     * @param request validated board payload
     * @return the persisted board (without columns)
     */
    public BoardResponse createBoard(BoardRequest request) {
        User user = securityUtils.getCurrentUser();

        Board board = Board.builder()
                .name(request.name())
                .description(request.description())
                .owner(user)
                .build();

        return toResponse(boardRepository.save(board), false);
    }

    /**
     * Updates name and/or description of an existing board.
     *
     * @param id      board identifier
     * @param request updated payload
     * @return the updated board (without columns)
     */
    public BoardResponse updateBoard(Long id, BoardRequest request) {
        User  user  = securityUtils.getCurrentUser();
        Board board = requireOwned(id, user.getId());

        board.setName(request.name());
        board.setDescription(request.description());

        return toResponse(boardRepository.save(board), false);
    }

    /**
     * Permanently deletes a board and all its columns / tasks (cascaded).
     *
     * @param id board identifier
     */
    public void deleteBoard(Long id) {
        User  user  = securityUtils.getCurrentUser();
        Board board = requireOwned(id, user.getId());
        boardRepository.delete(board);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /** Loads board and asserts ownership; throws 404 on failure. */
    private Board requireOwned(Long boardId, Long ownerId) {
        return boardRepository.findByIdAndOwnerId(boardId, ownerId)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", boardId));
    }

    private BoardResponse toResponse(Board board, boolean withColumns) {
        List<ColumnResponse> cols = withColumns
                ? board.getColumns().stream().map(this::toColumnResponse).toList()
                : List.of();

        return new BoardResponse(
                board.getId(),
                board.getName(),
                board.getDescription(),
                board.getCreatedAt(),
                cols);
    }

    private ColumnResponse toColumnResponse(BoardColumn col) {
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
