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
import com.kanban.repository.BoardColumnRepository;
import com.kanban.repository.BoardRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Business logic for Board CRUD.
 *
 * <h3>Access & Synchronization</h3>
 * <p>All authenticated users (ROLE_ADMIN and ROLE_USER) have access to view boards
 * and their respective columns and tasks. Transactions ensure fresh data is mapped
 * to DTOs without lazy loading issues.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BoardService {

    /** Default columns created for every new board. */
    private static final List<String> DEFAULT_COLUMN_TITLES =
            List.of("To Do", "In Progress", "In Review", "Done");

    private final BoardRepository       boardRepository;
    private final BoardColumnRepository columnRepository;
    private final SecurityUtils         securityUtils;

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns all boards with columns for all authenticated users.
     */
    @Transactional(readOnly = true)
    public List<BoardResponse> getAllBoards() {
        return boardRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(b -> toResponse(b, true))
                .toList();
    }

    /**
     * Returns a single board with all its columns and tasks.
     *
     * @param id board identifier
     * @throws ResourceNotFoundException if board not found
     */
    @Transactional(readOnly = true)
    public BoardResponse getBoard(Long id) {
        Board board = boardRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", id));
        return toResponse(board, true);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Creates a new board for the current user and auto-generates the four
     * default columns (To Do / In Progress / In Review / Done).
     *
     * @param request validated board payload
     * @return the persisted board (with default columns)
     */
    public BoardResponse createBoard(BoardRequest request) {
        User user = securityUtils.getCurrentUser();

        Board board = Board.builder()
                .name(request.name())
                .description(request.description())
                .owner(user)
                .columns(new ArrayList<>())
                .build();

        Board savedBoard = boardRepository.save(board);

        // Auto-create default columns
        for (int i = 0; i < DEFAULT_COLUMN_TITLES.size(); i++) {
            BoardColumn col = BoardColumn.builder()
                    .title(DEFAULT_COLUMN_TITLES.get(i))
                    .position(i)
                    .board(savedBoard)
                    .tasks(new ArrayList<>())
                    .build();
            columnRepository.save(col);
            savedBoard.getColumns().add(col);
        }

        boardRepository.flush();
        return toResponse(savedBoard, true);
    }

    /**
     * Updates name and/or description of an existing board.
     */
    public BoardResponse updateBoard(Long id, BoardRequest request) {
        Board board = boardRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", id));

        board.setName(request.name());
        board.setDescription(request.description());

        Board saved = boardRepository.save(board);
        boardRepository.flush();
        return toResponse(saved, true);
    }

    /**
     * Permanently deletes a board and all its columns / tasks (cascaded).
     */
    public void deleteBoard(Long id) {
        Board board = boardRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", id));
        boardRepository.delete(board);
        boardRepository.flush();
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private BoardResponse toResponse(Board board, boolean withColumns) {
        List<ColumnResponse> cols = withColumns && board.getColumns() != null
                ? board.getColumns().stream()
                        .sorted(java.util.Comparator.comparingInt(BoardColumn::getPosition))
                        .map(this::toColumnResponse)
                        .toList()
                : List.of();

        return new BoardResponse(
                board.getId(),
                board.getName(),
                board.getDescription(),
                board.getCreatedAt(),
                cols);
    }

    private ColumnResponse toColumnResponse(BoardColumn col) {
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
