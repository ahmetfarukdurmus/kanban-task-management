package com.kanban.service;

import com.kanban.dto.task.*;
import com.kanban.dto.user.UserSummaryDto;
import com.kanban.entity.*;
import com.kanban.entity.Task.Priority;
import com.kanban.entity.TaskCustomField.FieldType;
import com.kanban.exception.BusinessException;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.*;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Business logic for Task CRUD, multi-assignees, dynamic task types, transition rule validation,
 * checklists, custom fields, in-column reordering, and cross-column moves.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository                   taskRepository;
    private final BoardColumnRepository            columnRepository;
    private final BoardRepository                  boardRepository;
    private final UserRepository                   userRepository;
    private final TaskTypeRepository               taskTypeRepository;
    private final TaskTypeTransitionRuleRepository transitionRuleRepository;
    private final TaskChecklistItemRepository      checklistItemRepository;
    private final SecurityUtils                    securityUtils;

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns all tasks in a column, ordered by position.
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> getTasks(Long boardId, Long columnId) {
        requireColumn(boardId, columnId);

        return taskRepository.findAllByColumnIdOrderByPositionAsc(columnId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Returns a single task.
     */
    @Transactional(readOnly = true)
    public TaskResponse getTask(Long boardId, Long columnId, Long taskId) {
        requireColumn(boardId, columnId);
        return toResponse(requireTask(columnId, taskId));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Creates a new task appended at the end of the column.
     */
    public TaskResponse createTask(Long boardId, Long columnId, TaskRequest request) {
        BoardColumn column = requireColumn(boardId, columnId);
        int nextPosition = taskRepository.countByColumnId(columnId);

        // 1. Resolve Multi-Assignees
        Set<User> assignees = new HashSet<>();
        if (request.assigneeIds() != null && !request.assigneeIds().isEmpty()) {
            assignees.addAll(userRepository.findAllById(request.assigneeIds()));
        } else if (request.assignee() != null && !request.assignee().isBlank()) {
            userRepository.findByUsername(request.assignee().trim()).ifPresent(assignees::add);
        }

        // 2. Resolve TaskType (explicit request override or inherit from Board)
        TaskType taskType = null;
        if (request.taskTypeId() != null) {
            taskType = taskTypeRepository.findById(request.taskTypeId()).orElse(null);
        } else if (column.getBoard() != null && column.getBoard().getTaskType() != null) {
            taskType = column.getBoard().getTaskType();
        }

        // 3. Resolve Reporter (explicit request or fallback to current authenticated user)
        User reporter = null;
        if (request.reporterId() != null) {
            reporter = userRepository.findById(request.reporterId()).orElse(null);
        } else if (request.reporter() != null && !request.reporter().isBlank()) {
            reporter = userRepository.findByUsername(request.reporter().trim()).orElse(null);
        }
        if (reporter == null) {
            try {
                reporter = securityUtils.getCurrentUser();
            } catch (Exception ignored) {
                // If unauthenticated context, reporter remains null
            }
        }

        Task task = Task.builder()
                .title(request.title())
                .description(request.description())
                .priority(request.priority() != null ? request.priority() : Priority.MEDIUM)
                .dueDate(request.dueDate())
                .testDueDate(request.testDueDate())
                .targetEnvironment(request.targetEnvironment() != null && !request.targetEnvironment().isBlank() ? request.targetEnvironment().trim() : null)
                .estimatedHours(request.estimatedHours())
                .reporter(reporter)
                .taskType(taskType)
                .assignees(assignees)
                .position(nextPosition)
                .column(column)
                .comments(new ArrayList<>())
                .attachments(new ArrayList<>())
                .checklistItems(new ArrayList<>())
                .customFields(new ArrayList<>())
                .build();

        // 4. Custom fields
        if (request.customFields() != null) {
            for (CustomFieldDto dto : request.customFields()) {
                if (dto.fieldName() != null && !dto.fieldName().isBlank()) {
                    task.getCustomFields().add(TaskCustomField.builder()
                            .task(task)
                            .fieldName(dto.fieldName().trim())
                            .fieldType(parseFieldType(dto.fieldType()))
                            .fieldValue(dto.fieldValue())
                            .build());
                }
            }
        }

        // 5. Initial Checklist Items
        if (request.checklistItems() != null) {
            for (CreateChecklistItemRequest itemReq : request.checklistItems()) {
                if (itemReq.title() != null && !itemReq.title().isBlank()) {
                    task.getChecklistItems().add(TaskChecklistItem.builder()
                            .task(task)
                            .title(itemReq.title().trim())
                            .isCompleted(false)
                            .requiredForColumnId(itemReq.requiredForColumnId())
                            .build());
                }
            }
        }

        Task saved = taskRepository.save(task);
        taskRepository.flush();
        return toResponse(saved);
    }

    /**
     * Updates the fields, task type, assignees, and custom fields of an existing task.
     */
    public TaskResponse updateTask(Long boardId, Long columnId, Long taskId, TaskRequest request) {
        requireColumn(boardId, columnId);
        Task task = requireTask(columnId, taskId);
        return applyUpdate(task, request);
    }

    /**
     * Direct update by taskId (top-level endpoint support).
     */
    public TaskResponse updateTaskDirect(Long taskId, TaskRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));
        return applyUpdate(task, request);
    }

    private TaskResponse applyUpdate(Task task, TaskRequest request) {
        task.setTitle(request.title());
        task.setDescription(request.description());
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }
        task.setDueDate(request.dueDate());
        task.setTestDueDate(request.testDueDate());
        task.setTargetEnvironment(request.targetEnvironment() != null && !request.targetEnvironment().isBlank() ? request.targetEnvironment().trim() : null);
        task.setEstimatedHours(request.estimatedHours());

        // Update reporter if provided
        if (request.reporterId() != null) {
            userRepository.findById(request.reporterId()).ifPresent(task::setReporter);
        } else if (request.reporter() != null && !request.reporter().isBlank()) {
            userRepository.findByUsername(request.reporter().trim()).ifPresent(task::setReporter);
        }

        // Update task type
        if (request.taskTypeId() != null) {
            TaskType taskType = taskTypeRepository.findById(request.taskTypeId()).orElse(null);
            task.setTaskType(taskType);
        } else {
            task.setTaskType(null);
        }

        // Update assignees
        if (request.assigneeIds() != null) {
            task.getAssignees().clear();
            task.getAssignees().addAll(userRepository.findAllById(request.assigneeIds()));
        } else if (request.assignee() != null) {
            task.getAssignees().clear();
            if (!request.assignee().isBlank()) {
                userRepository.findByUsername(request.assignee().trim()).ifPresent(task.getAssignees()::add);
            }
        }

        // Update custom fields if provided
        if (request.customFields() != null) {
            task.getCustomFields().clear();
            for (CustomFieldDto dto : request.customFields()) {
                if (dto.fieldName() != null && !dto.fieldName().isBlank()) {
                    task.getCustomFields().add(TaskCustomField.builder()
                            .task(task)
                            .fieldName(dto.fieldName().trim())
                            .fieldType(parseFieldType(dto.fieldType()))
                            .fieldValue(dto.fieldValue())
                            .build());
                }
            }
        }

        Task saved = taskRepository.save(task);
        taskRepository.flush();
        return toResponse(saved);
    }

    /**
     * Deletes a task and closes the positional gap in its column.
     */
    public void deleteTask(Long boardId, Long columnId, Long taskId) {
        requireColumn(boardId, columnId);

        Task task       = requireTask(columnId, taskId);
        int  deletedPos = task.getPosition() != null ? task.getPosition() : 0;

        taskRepository.delete(task);
        taskRepository.flush();   // flush DELETE before the UPDATE

        // Close gap: shift all tasks after deletedPos left by 1
        taskRepository.shiftPositionsLeft(columnId, deletedPos, Integer.MAX_VALUE);
        taskRepository.flush();
    }

    /**
     * Moves or reorders a task via the unified Kanban drag-and-drop endpoint.
     * Enforces column transition rules (checklist completion & required attachments).
     */
    public TaskResponse moveTask(Long taskId, MoveTaskRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));

        Long srcColId = task.getColumn() != null ? task.getColumn().getId() : null;
        int  srcPos   = task.getPosition() != null ? task.getPosition() : 0;
        Long dstColId = request.targetColumnId();
        int  dstPos   = request.targetPosition();

        if (srcColId.equals(dstColId)) {
            // ── Case A: same-column reorder ────────────────────────────────
            int total       = taskRepository.countByColumnId(srcColId);
            int clampedDst  = Math.min(dstPos, total - 1);

            if (srcPos == clampedDst) {
                return toResponse(task);   // no-op
            }

            if (clampedDst > srcPos) {
                taskRepository.shiftPositionsLeft(srcColId, srcPos, clampedDst);
            } else {
                taskRepository.shiftPositionsRight(srcColId, clampedDst, srcPos);
            }
            task.setPosition(clampedDst);

        } else {
            // ── Case B: cross-column move with Transition Guard ────────────
            BoardColumn sourceColumn = task.getColumn();
            BoardColumn targetColumn = columnRepository.findById(dstColId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Column", dstColId));

            // Validate transition rules for this task type on the target column
            validateTransitionRules(task, sourceColumn, targetColumn);

            // 1. Close gap in source column
            taskRepository.shiftPositionsLeft(srcColId, srcPos, Integer.MAX_VALUE);

            // 2. Open gap in destination column
            taskRepository.shiftPositionsRight(dstColId, dstPos, Integer.MAX_VALUE);

            // 3. Move task
            task.setColumn(targetColumn);
            task.setPosition(dstPos);
        }

        taskRepository.flush();
        return toResponse(task);
    }

    /**
     * Validates column transition rules for the task's TaskType.
     * Performs ID-based, name-based, and semantic alias matching (e.g. 'To Do' == 'Yapılacaklar', 'In Progress' == 'Geliştirmede').
     * Throws {@link BusinessException} (mapped to 400 Bad Request) if any rule is violated.
     */
    private void validateTransitionRules(Task task, BoardColumn sourceColumn, BoardColumn targetColumn) {
        if (task.getTaskType() == null) {
            return;
        }

        if (task.getTaskType() != null) {
            TaskType type = task.getTaskType();
            String targetCat = getColumnCanonicalCategory(normalizeColumnName(targetColumn.getTitle()));
            if ("IN_REVIEW".equals(targetCat)) {
                if (Boolean.TRUE.equals(type.getRequireTestDate()) && task.getTestDueDate() == null) {
                    throw new BusinessException("Bu aşamaya (" + targetColumn.getTitle() + ") geçebilmek için 'Test Tarihi' girilmesi zorunludur.");
                }
                if (Boolean.TRUE.equals(type.getRequireEnvironment()) && (task.getTargetEnvironment() == null || task.getTargetEnvironment().isBlank())) {
                    throw new BusinessException("Bu aşamaya (" + targetColumn.getTitle() + ") geçebilmek için 'Test Ortamı' (DEV/TEST/STAGING/PROD) seçilmesi zorunludur.");
                }
            }
        }

        List<TaskTypeTransitionRule> rules = transitionRuleRepository
                .findAllByTaskTypeId(task.getTaskType().getId());

        if (rules == null || rules.isEmpty()) {
            return;
        }

        for (TaskTypeTransitionRule rule : rules) {
            // 1. Check target column match (by ID or Title semantic matching)
            boolean targetMatches = false;
            if (rule.getTargetColumn() != null && rule.getTargetColumn().getId().equals(targetColumn.getId())) {
                targetMatches = true;
            }
            if (!targetMatches && rule.getTargetTaskTypeColumn() != null && targetColumn.getTitle() != null) {
                if (isColumnTitleMatching(rule.getTargetTaskTypeColumn().getTitle(), targetColumn.getTitle())) {
                    targetMatches = true;
                }
            }
            if (!targetMatches && rule.getTargetColumnTitle() != null && targetColumn.getTitle() != null) {
                if (isColumnTitleMatching(rule.getTargetColumnTitle(), targetColumn.getTitle())) {
                    targetMatches = true;
                }
            }

            if (!targetMatches) {
                continue;
            }

            // 2. Check source column match (if source constraint is present)
            boolean hasSourceConstraint = (rule.getSourceColumn() != null)
                    || (rule.getSourceTaskTypeColumn() != null)
                    || (rule.getSourceColumnTitle() != null && !rule.getSourceColumnTitle().trim().isEmpty());

            if (hasSourceConstraint) {
                boolean sourceMatches = false;
                if (rule.getSourceColumn() != null && rule.getSourceColumn().getId().equals(sourceColumn.getId())) {
                    sourceMatches = true;
                }
                if (!sourceMatches && rule.getSourceTaskTypeColumn() != null && sourceColumn.getTitle() != null) {
                    if (isColumnTitleMatching(rule.getSourceTaskTypeColumn().getTitle(), sourceColumn.getTitle())) {
                        sourceMatches = true;
                    }
                }
                if (!sourceMatches && rule.getSourceColumnTitle() != null && sourceColumn.getTitle() != null) {
                    if (isColumnTitleMatching(rule.getSourceColumnTitle(), sourceColumn.getTitle())) {
                        sourceMatches = true;
                    }
                }

                if (!sourceMatches) {
                    continue;
                }
            }

            // 3. Enforce Rule Type Guard
            String ruleDesc = rule.getDescription() != null && !rule.getDescription().isBlank()
                    ? " (" + rule.getDescription() + ")"
                    : "";

            if (rule.getRuleType() == TransitionRuleType.ATTACHMENT_REQUIRED) {
                if (task.getAttachments() == null || task.getAttachments().isEmpty()) {
                    throw new BusinessException("Bu aşamaya (" + targetColumn.getTitle() + ") geçebilmek için görsel veya dosya eki yüklenmesi zorunludur." + ruleDesc);
                }
            } else if (rule.getRuleType() == TransitionRuleType.CHECKLIST_REQUIRED) {
                List<TaskChecklistItem> items = task.getChecklistItems();
                if (items == null || items.isEmpty()) {
                    throw new BusinessException("Bu aşamaya (" + targetColumn.getTitle() + ") geçebilmek için kontrol listesi maddelerinin tamamlanması zorunludur." + ruleDesc);
                }
                boolean anyUncompleted = items.stream().anyMatch(item -> !item.isCompleted());
                if (anyUncompleted) {
                    throw new BusinessException("Bu aşamaya (" + targetColumn.getTitle() + ") geçebilmek için kontrol listesi maddelerinin tamamlanması zorunludur." + ruleDesc);
                }
            }
        }
    }

    private static String normalizeColumnName(String name) {
        if (name == null) return "";
        String s = name.trim().toLowerCase(Locale.ROOT);
        s = s.replace('ç', 'c')
             .replace('ğ', 'g')
             .replace('ı', 'i')
             .replace('ö', 'o')
             .replace('ş', 's')
             .replace('ü', 'u')
             .replace('İ', 'i');
        return s.replaceAll("[^a-z0-9]", "");
    }

    private static String getColumnCanonicalCategory(String normalized) {
        if (normalized.isEmpty()) return "";

        // 1. TODO / Backlog
        if (normalized.contains("todo") || normalized.contains("yapilacak") || normalized.contains("backlog")
                || normalized.contains("open") || normalized.contains("acik") || normalized.contains("beklemede")
                || normalized.contains("tanimlandi") || normalized.contains("analiz") || normalized.contains("plan")) {
            return "TODO";
        }

        // 2. IN_PROGRESS / Development
        if (normalized.contains("inprogress") || normalized.contains("gelistirmede") || normalized.contains("dev")
                || normalized.contains("suruyor") || normalized.contains("devamediyor") || normalized.contains("islemde")
                || normalized.contains("calisiliyor") || normalized.contains("yapiliyor") || normalized.contains("doing")
                || normalized.contains("active") || normalized.contains("aktif") || normalized.contains("kodlama")
                || normalized.contains("progress")) {
            return "IN_PROGRESS";
        }

        // 3. IN_REVIEW / QA / Testing
        if (normalized.contains("inreview") || normalized.contains("review") || normalized.contains("test")
                || normalized.contains("qa") || normalized.contains("inceleme") || normalized.contains("kontrol")
                || normalized.contains("dogrulama") || normalized.contains("codereview") || normalized.contains("onay")
                || normalized.contains("denetim")) {
            return "IN_REVIEW";
        }

        // 4. DONE / Completed
        if (normalized.contains("done") || normalized.contains("tamamlandi") || normalized.contains("bitti")
                || normalized.contains("kapandi") || normalized.contains("completed") || normalized.contains("closed")
                || normalized.contains("finish") || normalized.contains("finished") || normalized.contains("sonuclandi")
                || normalized.contains("yayinda") || normalized.contains("deploy")) {
            return "DONE";
        }

        return normalized;
    }

    private static boolean isColumnTitleMatching(String ruleColTitle, String boardColTitle) {
        if (ruleColTitle == null || boardColTitle == null) return false;
        String norm1 = normalizeColumnName(ruleColTitle);
        String norm2 = normalizeColumnName(boardColTitle);

        if (norm1.isEmpty() || norm2.isEmpty()) return false;
        if (norm1.equals(norm2)) return true;
        if (norm1.contains(norm2) || norm2.contains(norm1)) return true;

        String cat1 = getColumnCanonicalCategory(norm1);
        String cat2 = getColumnCanonicalCategory(norm2);
        if (!cat1.isEmpty() && cat1.equals(cat2)) return true;

        return false;
    }

    // ── Checklist Management ──────────────────────────────────────────────────

    public TaskChecklistItemDto addChecklistItem(Long taskId, CreateChecklistItemRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));

        TaskChecklistItem item = TaskChecklistItem.builder()
                .task(task)
                .title(request.title().trim())
                .isCompleted(false)
                .requiredForColumnId(request.requiredForColumnId())
                .build();

        TaskChecklistItem saved = checklistItemRepository.save(item);
        return toChecklistDto(saved);
    }

    public TaskChecklistItemDto toggleChecklistItem(Long taskId, Long itemId) {
        TaskChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> ResourceNotFoundException.of("TaskChecklistItem", itemId));

        if (!item.getTask().getId().equals(taskId)) {
            throw new IllegalArgumentException("Kontrol maddesi bu göreve ait değil.");
        }

        item.setCompleted(!item.isCompleted());
        TaskChecklistItem saved = checklistItemRepository.save(item);
        return toChecklistDto(saved);
    }

    public TaskChecklistItemDto updateChecklistItem(Long taskId, Long itemId, UpdateChecklistItemRequest request) {
        TaskChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> ResourceNotFoundException.of("TaskChecklistItem", itemId));

        if (!item.getTask().getId().equals(taskId)) {
            throw new IllegalArgumentException("Kontrol maddesi bu göreve ait değil.");
        }

        if (request.title() != null && !request.title().isBlank()) {
            item.setTitle(request.title().trim());
        }
        if (request.isCompleted() != null) {
            item.setCompleted(request.isCompleted());
        }
        if (request.requiredForColumnId() != null) {
            item.setRequiredForColumnId(request.requiredForColumnId());
        }

        TaskChecklistItem saved = checklistItemRepository.save(item);
        return toChecklistDto(saved);
    }

    public void deleteChecklistItem(Long taskId, Long itemId) {
        TaskChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> ResourceNotFoundException.of("TaskChecklistItem", itemId));

        if (!item.getTask().getId().equals(taskId)) {
            throw new IllegalArgumentException("Kontrol maddesi bu göreve ait değil.");
        }

        checklistItemRepository.delete(item);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private BoardColumn requireColumn(Long boardId, Long columnId) {
        return columnRepository.findByIdAndBoardId(columnId, boardId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Column with ID " + columnId + " not found on board " + boardId));
    }

    private Task requireTask(Long columnId, Long taskId) {
        return taskRepository.findByIdAndColumnId(taskId, columnId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Task with ID " + taskId + " not found in column " + columnId));
    }

    private FieldType parseFieldType(String typeStr) {
        if (typeStr == null || typeStr.isBlank()) {
            return FieldType.TEXT;
        }
        try {
            return FieldType.valueOf(typeStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return FieldType.TEXT;
        }
    }

    private TaskChecklistItemDto toChecklistDto(TaskChecklistItem item) {
        return new TaskChecklistItemDto(
                item.getId(),
                item.getTask().getId(),
                item.getTitle(),
                item.isCompleted(),
                item.getRequiredForColumnId(),
                item.getCreatedAt());
    }

    private TaskResponse toResponse(Task task) {
        List<CustomFieldDto> fields = task.getCustomFields() != null
                ? task.getCustomFields().stream()
                        .map(f -> new CustomFieldDto(f.getId(), f.getFieldName(), f.getFieldType().name(), f.getFieldValue()))
                        .toList()
                : List.of();

        List<TaskChecklistItemDto> checklistDtos = task.getChecklistItems() != null
                ? task.getChecklistItems().stream()
                        .map(this::toChecklistDto)
                        .toList()
                : List.of();

        Set<Long> assigneeIds = task.getAssignees() != null
                ? task.getAssignees().stream().map(User::getId).collect(Collectors.toSet())
                : Set.of();

        List<UserSummaryDto> assigneeDtos = task.getAssignees() != null
                ? task.getAssignees().stream()
                        .map(u -> new UserSummaryDto(
                                u.getId(),
                                u.getUsername(),
                                u.getEmail(),
                                u.getRole() != null ? u.getRole().name() : "ROLE_USER",
                                u.getPrimaryOrganizationId(),
                                u.getPrimaryOrganizationName(),
                                u.getOrganizations() != null ? u.getOrganizations().stream().map(Organization::getId).toList() : List.of(),
                                u.getOrganizations() != null ? u.getOrganizations().stream().map(Organization::getName).toList() : List.of(),
                                u.getCreatedAt()))
                        .toList()
                : List.of();

        Long taskTypeId = task.getTaskType() != null ? task.getTaskType().getId() : null;
        String taskTypeName = task.getTaskType() != null ? task.getTaskType().getName() : null;
        String taskTypeColor = task.getTaskType() != null ? task.getTaskType().getColorHex() : null;

        UserSummaryDto reporterDto = null;
        Long reporterId = null;
        String reporterName = null;
        if (task.getReporter() != null) {
            User r = task.getReporter();
            reporterId = r.getId();
            reporterName = r.getUsername();
            reporterDto = new UserSummaryDto(
                    r.getId(),
                    r.getUsername(),
                    r.getEmail(),
                    r.getRole() != null ? r.getRole().name() : "ROLE_USER",
                    r.getPrimaryOrganizationId(),
                    r.getPrimaryOrganizationName(),
                    r.getOrganizations() != null ? r.getOrganizations().stream().map(Organization::getId).toList() : List.of(),
                    r.getOrganizations() != null ? r.getOrganizations().stream().map(Organization::getName).toList() : List.of(),
                    r.getCreatedAt());
        }

        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority() != null ? task.getPriority().name() : "MEDIUM",
                task.getDueDate(),
                task.getTestDueDate(),
                task.getTargetEnvironment(),
                task.getEstimatedHours(),
                reporterId,
                reporterName,
                reporterDto,
                task.getAssignee(),
                task.getPosition() != null ? task.getPosition() : 0,
                task.getColumn() != null ? task.getColumn().getId() : null,
                fields,
                taskTypeId,
                taskTypeName,
                taskTypeColor,
                assigneeIds,
                assigneeDtos,
                checklistDtos);
    }
}
