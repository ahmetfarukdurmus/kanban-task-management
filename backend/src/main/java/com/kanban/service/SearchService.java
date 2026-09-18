package com.kanban.service;

import com.kanban.dto.search.BoardSearchDto;
import com.kanban.dto.search.GlobalSearchResponse;
import com.kanban.dto.search.TaskSearchDto;
import com.kanban.entity.Board;
import com.kanban.entity.BoardColumn;
import com.kanban.entity.Organization;
import com.kanban.entity.Role;
import com.kanban.entity.Task;
import com.kanban.entity.User;
import com.kanban.repository.BoardRepository;
import com.kanban.repository.TaskRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service providing full global search across task keys, titles, descriptions, tags, board names, and organizations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;
    private final SecurityUtils securityUtils;

    @Transactional(readOnly = true)
    public GlobalSearchResponse search(String query) {
        if (query == null || query.isBlank()) {
            return GlobalSearchResponse.of(List.of(), List.of());
        }

        String rawQuery = query.trim();
        String lowerQuery = rawQuery.toLowerCase(Locale.ROOT);

        User currentUser = securityUtils.getCurrentUser();
        boolean isSuperAdmin = currentUser.getRole() == Role.ROLE_SUPER_ADMIN;

        // 1. Fetch accessible boards for the current user
        List<Board> accessibleBoards;
        if (isSuperAdmin) {
            accessibleBoards = boardRepository.findAllByOrderByCreatedAtDesc();
        } else {
            Set<Long> orgIds = currentUser.getOrganizations() != null
                    ? currentUser.getOrganizations().stream().map(Organization::getId).collect(Collectors.toSet())
                    : Set.of();

            if (orgIds.isEmpty()) {
                accessibleBoards = boardRepository.findAccessibleBoardsForUser(List.of(-1L), currentUser.getId(), currentUser.getUsername());
            } else {
                accessibleBoards = boardRepository.findAccessibleBoardsForUser(orgIds, currentUser.getId(), currentUser.getUsername());
            }
        }

        Set<Long> accessibleBoardIds = accessibleBoards.stream().map(Board::getId).collect(Collectors.toSet());

        // 2. Search Boards
        List<BoardSearchDto> matchedBoards = accessibleBoards.stream()
                .filter(b -> {
                    String title = b.getName() != null ? b.getName().toLowerCase(Locale.ROOT) : "";
                    String desc = b.getDescription() != null ? b.getDescription().toLowerCase(Locale.ROOT) : "";
                    String orgName = b.getOrganization() != null && b.getOrganization().getName() != null
                            ? b.getOrganization().getName().toLowerCase(Locale.ROOT) : "";
                    return title.contains(lowerQuery) || desc.contains(lowerQuery) || orgName.contains(lowerQuery);
                })
                .limit(10)
                .map(b -> {
                    int colCount = b.getColumns() != null ? b.getColumns().size() : 0;
                    int taskCount = b.getColumns() != null
                            ? b.getColumns().stream().mapToInt(c -> c.getTasks() != null ? c.getTasks().size() : 0).sum()
                            : 0;
                    return new BoardSearchDto(
                            b.getId(),
                            b.getName(),
                            b.getDescription(),
                            b.getOrganization() != null ? b.getOrganization().getId() : null,
                            b.getOrganization() != null ? b.getOrganization().getName() : null,
                            colCount,
                            taskCount
                    );
                })
                .toList();

        // 3. Search Tasks
        // Find tasks in accessible boards that match taskKey, title, description, tags, board title, column title
        List<TaskSearchDto> matchedTasks = accessibleBoards.stream()
                .filter(b -> b.getColumns() != null)
                .flatMap(b -> b.getColumns().stream())
                .filter(c -> c.getTasks() != null)
                .flatMap(c -> c.getTasks().stream())
                .filter(t -> {
                    String taskKey = t.getTaskKey() != null ? t.getTaskKey().toLowerCase(Locale.ROOT) : "";
                    String title = t.getTitle() != null ? t.getTitle().toLowerCase(Locale.ROOT) : "";
                    String desc = t.getDescription() != null ? t.getDescription().toLowerCase(Locale.ROOT) : "";
                    String boardName = t.getColumn() != null && t.getColumn().getBoard() != null && t.getColumn().getBoard().getName() != null
                            ? t.getColumn().getBoard().getName().toLowerCase(Locale.ROOT) : "";
                    String colName = t.getColumn() != null && t.getColumn().getTitle() != null
                            ? t.getColumn().getTitle().toLowerCase(Locale.ROOT) : "";

                    boolean tagMatch = t.getTags() != null && t.getTags().stream()
                            .anyMatch(tag -> tag != null && tag.toLowerCase(Locale.ROOT).contains(lowerQuery));

                    // Exact or partial taskKey match (e.g. "FW-14", "FW", "14")
                    boolean keyMatch = taskKey.contains(lowerQuery) || String.valueOf(t.getId()).equals(rawQuery);

                    return keyMatch || title.contains(lowerQuery) || desc.contains(lowerQuery) || tagMatch || boardName.contains(lowerQuery) || colName.contains(lowerQuery);
                })
                .limit(20)
                .map(t -> {
                    String prefix = t.getTaskType() != null && t.getTaskType().getTaskPrefix() != null
                            ? t.getTaskType().getTaskPrefix()
                            : (t.getTaskType() != null ? TaskTypeService.derivePrefix(t.getTaskType().getName(), null) : "TASK");
                    String key = t.getTaskKey() != null ? t.getTaskKey() : (prefix + "-" + t.getId());
                    Long boardId = t.getColumn() != null && t.getColumn().getBoard() != null ? t.getColumn().getBoard().getId() : null;
                    String boardTitle = t.getColumn() != null && t.getColumn().getBoard() != null ? t.getColumn().getBoard().getName() : "";
                    Long colId = t.getColumn() != null ? t.getColumn().getId() : null;
                    String colTitle = t.getColumn() != null ? t.getColumn().getTitle() : "";
                    String colorHex = t.getTaskType() != null ? t.getTaskType().getColorHex() : null;
                    Set<String> tags = t.getTags() != null ? new HashSet<>(t.getTags()) : Set.of();

                    return new TaskSearchDto(
                            t.getId(),
                            key,
                            t.getTitle(),
                            t.getPriority() != null ? t.getPriority().name() : "MEDIUM",
                            boardId,
                            boardTitle,
                            colId,
                            colTitle,
                            colorHex,
                            tags
                    );
                })
                .toList();

        log.debug("Global search for '{}' returned {} tasks and {} boards", rawQuery, matchedTasks.size(), matchedBoards.size());
        return GlobalSearchResponse.of(matchedTasks, matchedBoards);
    }
}
