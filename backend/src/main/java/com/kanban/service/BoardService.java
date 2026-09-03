package com.kanban.service;

import com.kanban.dto.board.BoardRequest;
import com.kanban.dto.board.BoardResponse;
import com.kanban.dto.column.ColumnResponse;
import com.kanban.dto.task.CustomFieldDto;
import com.kanban.dto.task.TaskResponse;
import com.kanban.entity.Board;
import com.kanban.entity.BoardColumn;
import com.kanban.entity.BoardType;
import com.kanban.entity.Organization;
import com.kanban.entity.Role;
import com.kanban.entity.Task;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.BoardColumnRepository;
import com.kanban.repository.BoardRepository;
import com.kanban.repository.OrganizationRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Business logic for Board CRUD supporting Super Admin, Department Admin, and Department Member,
 * along with pre-configured template columns.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BoardService {

    /** Default columns created for STANDARD board template. */
    private static final List<String> STANDARD_COLUMNS =
            List.of("To Do", "In Progress", "In Review", "Done");

    /** Default columns created for INTEGRATION board template. */
    private static final List<String> INTEGRATION_COLUMNS =
            List.of("Backlog", "Analiz & Mapping", "Geliştirme", "Sandbox Test", "Canlıya Alındı");

    /** Default columns created for QA_TEST board template. */
    private static final List<String> QA_TEST_COLUMNS =
            List.of("Backlog", "Geliştirme", "Teste Hazır", "Test Ediliyor", "Tamamlandı");

    private final BoardRepository        boardRepository;
    private final BoardColumnRepository  columnRepository;
    private final OrganizationRepository organizationRepository;
    private final SecurityUtils          securityUtils;

    private boolean isSuperAdmin(User user) {
        return user.getRole() == Role.ROLE_SUPER_ADMIN || (user.getRole() == Role.ROLE_ADMIN && user.getOrganization() == null);
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns boards based on caller's role and organization:
     * - Super Admin (ROLE_SUPER_ADMIN or ROLE_ADMIN with null org): ALL boards across all departments.
     * - Department Admin / Member (org != null): ONLY boards in their own department.
     */
    @Transactional(readOnly = true)
    public List<BoardResponse> getAllBoards() {
        User currentUser = securityUtils.getCurrentUser();
        boolean superAdmin = isSuperAdmin(currentUser);

        List<Board> boards;
        if (superAdmin) {
            boards = boardRepository.findAllByOrderByCreatedAtDesc();
        } else {
            Long orgId = currentUser.getOrganization() != null ? currentUser.getOrganization().getId() : null;
            if (orgId != null) {
                boards = boardRepository.findAllByOrganizationIdOrderByCreatedAtDesc(orgId);
            } else {
                boards = boardRepository.findAllByOrderByCreatedAtDesc();
            }
        }

        return boards.stream()
                .map(b -> toResponse(b, true))
                .toList();
    }

    /**
     * Returns a single board with all its columns and tasks.
     * Super Admin can access any board; Department users can only access their department's board.
     *
     * @param id board identifier
     * @throws ResourceNotFoundException if board not found or unauthorized
     */
    @Transactional(readOnly = true)
    public BoardResponse getBoard(Long id) {
        User currentUser = securityUtils.getCurrentUser();
        boolean superAdmin = isSuperAdmin(currentUser);

        Board board = boardRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", id));

        // Department isolation check
        if (!superAdmin) {
            Long orgId = currentUser.getOrganization() != null ? currentUser.getOrganization().getId() : null;
            if (orgId != null && board.getOrganization() != null && !board.getOrganization().getId().equals(orgId)) {
                throw ResourceNotFoundException.of("Board", id);
            }
        }

        return toResponse(board, true);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Creates a new board and auto-generates columns based on selected template:
     * - Super Admin: assigns board to the selected department (organizationId in request).
     * - Department Admin: assigns board automatically to their own department.
     *
     * @param request validated board payload
     * @return the persisted board (with default columns)
     */
    public BoardResponse createBoard(BoardRequest request) {
        User currentUser = securityUtils.getCurrentUser();
        boolean superAdmin = isSuperAdmin(currentUser);

        Organization targetOrg;
        if (superAdmin) {
            if (request.organizationId() != null) {
                targetOrg = organizationRepository.findById(request.organizationId())
                        .orElseGet(() -> organizationRepository.findAll().stream().findFirst().orElse(null));
            } else {
                targetOrg = organizationRepository.findAll().stream().findFirst().orElse(null);
            }
        } else {
            targetOrg = currentUser.getOrganization();
        }

        BoardType type = request.boardType() != null ? request.boardType() : BoardType.STANDARD;

        Board board = Board.builder()
                .name(request.name())
                .description(request.description())
                .boardType(type)
                .owner(currentUser)
                .organization(targetOrg)
                .columns(new ArrayList<>())
                .build();

        Board savedBoard = boardRepository.save(board);

        // Determine columns based on boardType template
        List<String> columnTitles = switch (type) {
            case INTEGRATION -> INTEGRATION_COLUMNS;
            case QA_TEST     -> QA_TEST_COLUMNS;
            default          -> STANDARD_COLUMNS;
        };

        // Auto-create default columns for chosen template
        for (int i = 0; i < columnTitles.size(); i++) {
            BoardColumn col = BoardColumn.builder()
                    .title(columnTitles.get(i))
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
        User currentUser = securityUtils.getCurrentUser();
        boolean superAdmin = isSuperAdmin(currentUser);

        Board board = boardRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", id));

        if (!superAdmin) {
            Long orgId = currentUser.getOrganization() != null ? currentUser.getOrganization().getId() : null;
            if (orgId != null && board.getOrganization() != null && !board.getOrganization().getId().equals(orgId)) {
                throw ResourceNotFoundException.of("Board", id);
            }
        }

        board.setName(request.name());
        board.setDescription(request.description());

        Board saved = boardRepository.save(board);
        boardRepository.flush();
        return toResponse(saved, true);
    }

    /**
     * Permanently deletes a board (Admin only):
     * - Super Admin can delete any board.
     * - Department Admin can only delete boards in their own department.
     */
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public void deleteBoard(Long id) {
        User currentUser = securityUtils.getCurrentUser();
        boolean superAdmin = isSuperAdmin(currentUser);

        Board board = boardRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", id));

        if (!superAdmin) {
            Long orgId = currentUser.getOrganization() != null ? currentUser.getOrganization().getId() : null;
            if (orgId != null && board.getOrganization() != null && !board.getOrganization().getId().equals(orgId)) {
                throw ResourceNotFoundException.of("Board", id);
            }
        }

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
                cols,
                board.getOrganization() != null ? board.getOrganization().getId() : null,
                board.getOrganization() != null ? board.getOrganization().getName() : null,
                board.getBoardType() != null ? board.getBoardType().name() : "STANDARD");
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
        List<CustomFieldDto> fields = task.getCustomFields() != null
                ? task.getCustomFields().stream()
                        .map(f -> new CustomFieldDto(f.getId(), f.getFieldName(), f.getFieldType().name(), f.getFieldValue()))
                        .toList()
                : List.of();

        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority().name(),
                task.getDueDate(),
                task.getAssignee(),
                task.getPosition(),
                task.getColumn().getId(),
                fields);
    }
}
