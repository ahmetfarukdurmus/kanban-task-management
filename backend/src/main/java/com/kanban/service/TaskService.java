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
    private final TaskActivityService              activityService;
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

        // 3.5 Validate TaskType required custom fields
        validateTaskTypeRequiredFields(taskType, request.customFields());

        Set<String> tags = new HashSet<>();
        if (request.tags() != null) {
            for (String tag : request.tags()) {
                if (tag != null && !tag.isBlank()) {
                    tags.add(tag.trim());
                }
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
                .tags(tags)
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

        // Assign taskKey with strict priority on taskType.taskPrefix
        TaskType effectiveType = saved.getTaskType();
        if (effectiveType == null && column.getBoard() != null) {
            effectiveType = column.getBoard().getTaskType();
        }
        String prefix = (effectiveType != null && effectiveType.getTaskPrefix() != null && !effectiveType.getTaskPrefix().isBlank())
                ? effectiveType.getTaskPrefix()
                : (effectiveType != null ? TaskTypeService.derivePrefix(effectiveType.getName(), null)
                : (column.getBoard() != null && column.getBoard().getBoardKey() != null && !column.getBoard().getBoardKey().isBlank() && !"BOARD".equalsIgnoreCase(column.getBoard().getBoardKey())
                        ? column.getBoard().getBoardKey()
                        : "TASK"));
        saved.setTaskKey(prefix + "-" + saved.getId());
        saved = taskRepository.save(saved);
        taskRepository.flush();

        // Record creation activity
        String reporterName = saved.getReporter() != null ? saved.getReporter().getUsername() : "Bilinmeyen";
        activityService.recordActivity(saved, TaskActivityType.CREATED,
                "Görev oluşturuldu / raporlandı (Raporlayan: " + reporterName + ")", null, saved.getTitle());

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
        // 1. Title Diff
        if (request.title() != null && !request.title().isBlank() && !request.title().trim().equals(task.getTitle())) {
            activityService.recordActivity(task, TaskActivityType.TITLE_UPDATED,
                    "Görev başlığı güncellendi", task.getTitle(), request.title().trim());
            task.setTitle(request.title().trim());
        }

        // 2. Description Diff
        String newDesc = request.description() != null ? request.description().trim() : "";
        String oldDesc = task.getDescription() != null ? task.getDescription().trim() : "";
        if (!newDesc.equals(oldDesc)) {
            activityService.recordActivity(task, TaskActivityType.DESCRIPTION_UPDATED,
                    "Görev açıklaması güncellendi", oldDesc, newDesc);
            task.setDescription(request.description());
        }

        // 3. Priority Diff
        if (request.priority() != null && task.getPriority() != request.priority()) {
            activityService.recordActivity(task, TaskActivityType.PRIORITY_CHANGED,
                    "Öncelik '" + task.getPriority().name() + "' yerine '" + request.priority().name() + "' olarak değiştirildi",
                    task.getPriority().name(), request.priority().name());
            task.setPriority(request.priority());
        }

        // 4. Due Date Diff
        if (!java.util.Objects.equals(task.getDueDate(), request.dueDate())) {
            String oldDue = task.getDueDate() != null ? task.getDueDate().toString() : "Belirtilmemiş";
            String newDue = request.dueDate() != null ? request.dueDate().toString() : "Belirtilmemiş";
            activityService.recordActivity(task, TaskActivityType.DUE_DATE_CHANGED,
                    "Bitiş tarihi '" + oldDue + "' yerine '" + newDue + "' olarak güncellendi",
                    oldDue, newDue);
            task.setDueDate(request.dueDate());
        }
        task.setTestDueDate(request.testDueDate());
        task.setTargetEnvironment(request.targetEnvironment() != null && !request.targetEnvironment().isBlank() ? request.targetEnvironment().trim() : null);

        // 5. Estimated Hours Diff
        if (!java.util.Objects.equals(task.getEstimatedHours(), request.estimatedHours())) {
            String oldHours = task.getEstimatedHours() != null ? task.getEstimatedHours() + " Saat / SP" : "Belirtilmemiş";
            String newHours = request.estimatedHours() != null ? request.estimatedHours() + " Saat / SP" : "Belirtilmemiş";
            activityService.recordActivity(task, TaskActivityType.FIELD_UPDATED,
                    "Tahmini efor süresi '" + oldHours + "' yerine '" + newHours + "' olarak güncellendi",
                    oldHours, newHours);
            task.setEstimatedHours(request.estimatedHours());
        }

        // Update reporter if provided
        if (request.reporterId() != null) {
            userRepository.findById(request.reporterId()).ifPresent(task::setReporter);
        } else if (request.reporter() != null && !request.reporter().isBlank()) {
            userRepository.findByUsername(request.reporter().trim()).ifPresent(task::setReporter);
        }

        // 6. Update task type Diff
        Long oldTypeId = task.getTaskType() != null ? task.getTaskType().getId() : null;
        String oldTypeName = task.getTaskType() != null ? task.getTaskType().getName() : "Standart";
        TaskType taskType = null;
        if (request.taskTypeId() != null) {
            taskType = taskTypeRepository.findById(request.taskTypeId()).orElse(null);
            task.setTaskType(taskType);
        } else if (task.getTaskType() == null && task.getColumn() != null && task.getColumn().getBoard() != null && task.getColumn().getBoard().getTaskType() != null) {
            taskType = task.getColumn().getBoard().getTaskType();
            task.setTaskType(taskType);
        }
        Long newTypeId = task.getTaskType() != null ? task.getTaskType().getId() : null;
        String newTypeName = task.getTaskType() != null ? task.getTaskType().getName() : "Standart";
        if (!java.util.Objects.equals(oldTypeId, newTypeId)) {
            activityService.recordActivity(task, TaskActivityType.FIELD_UPDATED,
                    "Görev tipi '" + oldTypeName + "' yerine '" + newTypeName + "' olarak güncellendi",
                    oldTypeName, newTypeName);
        }

        // Validate TaskType required custom fields if customFields were submitted
        if (task.getTaskType() != null && request.customFields() != null) {
            validateTaskTypeRequiredFields(task.getTaskType(), request.customFields());
        }

        // 7. Update assignees Diff
        Set<Long> oldAssigneeIds = task.getAssignees() != null
                ? task.getAssignees().stream().map(User::getId).collect(Collectors.toSet())
                : Set.of();
        Set<String> oldAssigneeNames = task.getAssignees() != null
                ? task.getAssignees().stream().map(User::getUsername).collect(Collectors.toSet())
                : Set.of();

        Set<User> newAssignees = new HashSet<>();
        if (request.assigneeIds() != null) {
            newAssignees.addAll(userRepository.findAllById(request.assigneeIds()));
        } else if (request.assignee() != null) {
            if (!request.assignee().isBlank()) {
                userRepository.findByUsername(request.assignee().trim()).ifPresent(newAssignees::add);
            }
        }
        Set<Long> newAssigneeIds = newAssignees.stream().map(User::getId).collect(Collectors.toSet());
        Set<String> newAssigneeNames = newAssignees.stream().map(User::getUsername).collect(Collectors.toSet());

        if (!oldAssigneeIds.equals(newAssigneeIds)) {
            String oldVal = oldAssigneeNames.isEmpty() ? "Atanan Yok" : String.join(", ", oldAssigneeNames);
            String newVal = newAssigneeNames.isEmpty() ? "Atanan Yok" : String.join(", ", newAssigneeNames);
            activityService.recordActivity(task, TaskActivityType.ASSIGNEE_CHANGED,
                    "Atanan kişi(ler) güncellendi: " + newVal,
                    oldVal, newVal);
            task.getAssignees().clear();
            task.getAssignees().addAll(newAssignees);
        }

        // 8. Update tags Diff
        if (request.tags() != null) {
            Set<String> cleanTags = request.tags().stream()
                    .filter(t -> t != null && !t.isBlank())
                    .map(String::trim)
                    .collect(Collectors.toSet());
            Set<String> existingTags = task.getTags() != null ? task.getTags() : Set.of();
            if (!existingTags.equals(cleanTags)) {
                String oldTagsStr = existingTags.isEmpty() ? "Yok" : String.join(", ", existingTags);
                String newTagsStr = cleanTags.isEmpty() ? "Yok" : String.join(", ", cleanTags);
                activityService.recordActivity(task, TaskActivityType.FIELD_UPDATED,
                        "Etiketler güncellendi: " + newTagsStr,
                        oldTagsStr, newTagsStr);
                if (task.getTags() == null) {
                    task.setTags(new HashSet<>());
                }
                task.getTags().clear();
                task.getTags().addAll(cleanTags);
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

        // Always synchronize taskKey with strict priority on taskType.taskPrefix
        TaskType effectiveType = task.getTaskType();
        if (effectiveType == null && task.getColumn() != null && task.getColumn().getBoard() != null) {
            effectiveType = task.getColumn().getBoard().getTaskType();
        }
        String prefix = (effectiveType != null && effectiveType.getTaskPrefix() != null && !effectiveType.getTaskPrefix().isBlank())
                ? effectiveType.getTaskPrefix()
                : (effectiveType != null ? TaskTypeService.derivePrefix(effectiveType.getName(), null)
                : (task.getColumn() != null && task.getColumn().getBoard() != null && task.getColumn().getBoard().getBoardKey() != null && !task.getColumn().getBoard().getBoardKey().isBlank() && !"BOARD".equalsIgnoreCase(task.getColumn().getBoard().getBoardKey())
                        ? task.getColumn().getBoard().getBoardKey()
                        : "TASK"));
        task.setTaskKey(prefix + "-" + task.getId());

        Task saved = taskRepository.save(task);
        taskRepository.flush();
        return toResponse(saved);
    }

    private void validateTaskTypeRequiredFields(TaskType taskType, List<CustomFieldDto> customFields) {
        if (taskType == null || taskType.getFields() == null || taskType.getFields().isEmpty()) {
            return;
        }

        for (TaskTypeField field : taskType.getFields()) {
            if (field.isRequired()) {
                String reqName = field.getFieldName() != null ? field.getFieldName().trim() : "";
                if (reqName.isEmpty()) continue;

                boolean foundAndFilled = false;
                if (customFields != null) {
                    for (CustomFieldDto dto : customFields) {
                        if (dto.fieldName() != null && dto.fieldName().trim().equalsIgnoreCase(reqName)) {
                            if (dto.fieldValue() != null && !dto.fieldValue().trim().isEmpty()) {
                                foundAndFilled = true;
                                break;
                            }
                        }
                    }
                }

                if (!foundAndFilled) {
                    throw new BusinessException("'" + reqName + "' alanı bu görev tipi (" + taskType.getName() + ") için zorunludur.");
                }
            }
        }
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

            // Record STATUS_CHANGED activity
            String srcColTitle = sourceColumn != null ? sourceColumn.getTitle() : "Bilinmeyen";
            String dstColTitle = targetColumn.getTitle() != null ? targetColumn.getTitle() : "Bilinmeyen";
            activityService.recordActivity(task, TaskActivityType.STATUS_CHANGED,
                    "Görev durumu '" + srcColTitle + "' aşamasından '" + dstColTitle + "' aşamasına taşındı",
                    srcColTitle, dstColTitle);
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
        if (sourceColumn != null && targetColumn != null && !sourceColumn.getId().equals(targetColumn.getId())) {
            // 0. Enforce sequential column transition (cannot skip forward across columns)
            if (sourceColumn.getBoard() != null) {
                List<BoardColumn> boardColumns = columnRepository.findAllByBoardIdOrderByPositionAsc(sourceColumn.getBoard().getId());
                int srcIdx = -1;
                int dstIdx = -1;
                for (int i = 0; i < boardColumns.size(); i++) {
                    if (boardColumns.get(i).getId().equals(sourceColumn.getId())) {
                        srcIdx = i;
                    }
                    if (boardColumns.get(i).getId().equals(targetColumn.getId())) {
                        dstIdx = i;
                    }
                }
                if (srcIdx != -1 && dstIdx != -1 && dstIdx > srcIdx + 1) {
                    BoardColumn nextCol = boardColumns.get(srcIdx + 1);
                    throw new BusinessException("Görevler aşamaları atlayarak taşınamaz. Lütfen iş akışı sırasını takip edin (Sıradaki aşama: " + nextCol.getTitle() + ").");
                }
            }
        }

        if (task.getTaskType() == null) {
            return;
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

                // 3a. Find items specifically matching this rule's description
                String normRuleDesc = rule.getDescription() != null ? normalizeColumnName(rule.getDescription()) : "";
                List<TaskChecklistItem> descMatchedItems = new ArrayList<>();
                if (!normRuleDesc.isEmpty()) {
                    for (TaskChecklistItem item : items) {
                        String normContent = normalizeColumnName(item.getTitle());
                        if (normContent.contains(normRuleDesc) || normRuleDesc.contains(normContent)) {
                            descMatchedItems.add(item);
                        }
                    }
                }

                // 3b. Find items explicitly bound to this target column ID
                List<TaskChecklistItem> colMatchedItems = items.stream()
                        .filter(item -> item.getRequiredForColumnId() != null && item.getRequiredForColumnId().equals(targetColumn.getId()))
                        .toList();

                List<TaskChecklistItem> targetItemsToCheck;
                if (!descMatchedItems.isEmpty()) {
                    targetItemsToCheck = descMatchedItems;
                } else if (!colMatchedItems.isEmpty()) {
                    targetItemsToCheck = colMatchedItems;
                } else {
                    // Filter out items that belong explicitly to other columns
                    targetItemsToCheck = items.stream()
                            .filter(item -> item.getRequiredForColumnId() == null || item.getRequiredForColumnId().equals(targetColumn.getId()))
                            .toList();
                }

                if (targetItemsToCheck.isEmpty() || targetItemsToCheck.stream().anyMatch(item -> !item.isCompleted())) {
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
        activityService.recordActivity(task, TaskActivityType.CHECKLIST_UPDATED,
                "Kontrol listesine yeni madde eklendi: '" + saved.getTitle() + "'",
                null, saved.getTitle());
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
        String statusText = saved.isCompleted() ? "tamamlandı olarak işaretlendi" : "tamamlanmadı olarak işaretlendi";
        activityService.recordActivity(item.getTask(), TaskActivityType.CHECKLIST_UPDATED,
                "Kontrol listesi maddesi (" + saved.getTitle() + ") " + statusText,
                saved.isCompleted() ? "Beklemede" : "Tamamlandı",
                saved.isCompleted() ? "Tamamlandı" : "Beklemede");
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
        activityService.recordActivity(item.getTask(), TaskActivityType.CHECKLIST_UPDATED,
                "Kontrol listesi maddesi güncellendi: '" + saved.getTitle() + "'",
                null, saved.getTitle());
        return toChecklistDto(saved);
    }

    public void deleteChecklistItem(Long taskId, Long itemId) {
        TaskChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> ResourceNotFoundException.of("TaskChecklistItem", itemId));

        if (!item.getTask().getId().equals(taskId)) {
            throw new IllegalArgumentException("Kontrol maddesi bu göreve ait değil.");
        }

        Task task = item.getTask();
        String title = item.getTitle();
        checklistItemRepository.delete(item);
        activityService.recordActivity(task, TaskActivityType.CHECKLIST_UPDATED,
                "Kontrol listesi maddesi silindi: '" + title + "'",
                title, null);
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

        TaskType effectiveType = task.getTaskType();
        if (effectiveType == null && task.getColumn() != null && task.getColumn().getBoard() != null) {
            effectiveType = task.getColumn().getBoard().getTaskType();
        }

        Long taskTypeId = effectiveType != null ? effectiveType.getId() : null;
        String taskTypeName = effectiveType != null ? effectiveType.getName() : null;
        String taskTypeColor = effectiveType != null ? effectiveType.getColorHex() : null;

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

        Board board = task.getColumn() != null ? task.getColumn().getBoard() : null;
        String boardKey = board != null ? board.getEffectiveBoardKey() : null;
        String taskPrefix = (effectiveType != null && effectiveType.getTaskPrefix() != null && !effectiveType.getTaskPrefix().isBlank())
                ? effectiveType.getTaskPrefix()
                : (boardKey != null ? boardKey : (effectiveType != null ? TaskTypeService.derivePrefix(effectiveType.getName(), null) : "TASK"));
        if (boardKey == null) {
            boardKey = taskPrefix;
        }
        String taskKey = task.getEffectiveTaskKey();
        Set<String> tags = task.getTags() != null ? new HashSet<>(task.getTags()) : Set.of();

        return new TaskResponse(
                task.getId(),
                taskKey,
                boardKey,
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
                taskPrefix,
                assigneeIds,
                assigneeDtos,
                checklistDtos,
                tags);
    }

    /**
     * Searches tasks across all boards accessible to current user by taskKey, title, description, or tags.
     */
    @Transactional(readOnly = true)
    public List<TaskSearchResultDto> searchTasks(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        String rawQuery = query.trim();
        String lowerQuery = rawQuery.toLowerCase(Locale.ROOT);

        User currentUser = securityUtils.getCurrentUser();
        boolean isSuperAdmin = currentUser.getRole() == Role.ROLE_SUPER_ADMIN;

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

        return accessibleBoards.stream()
                .filter(b -> b.getColumns() != null)
                .flatMap(b -> b.getColumns().stream())
                .filter(c -> c.getTasks() != null)
                .flatMap(c -> c.getTasks().stream())
                .filter(t -> {
                    String key = t.getEffectiveTaskKey();
                    String lowerKey = key.toLowerCase(Locale.ROOT);

                    String title = t.getTitle() != null ? t.getTitle().toLowerCase(Locale.ROOT) : "";
                    String desc = t.getDescription() != null ? t.getDescription().toLowerCase(Locale.ROOT) : "";

                    boolean tagMatch = t.getTags() != null && t.getTags().stream()
                            .anyMatch(tag -> tag != null && tag.toLowerCase(Locale.ROOT).contains(lowerQuery));

                    boolean keyMatch = lowerKey.contains(lowerQuery) || String.valueOf(t.getId()).equals(rawQuery);
                    boolean titleMatch = title.contains(lowerQuery);
                    boolean descMatch = desc.contains(lowerQuery);

                    return keyMatch || titleMatch || descMatch || tagMatch;
                })
                .limit(20)
                .map(t -> {
                    TaskType effectiveType = t.getTaskType();
                    if (effectiveType == null && t.getColumn() != null && t.getColumn().getBoard() != null) {
                        effectiveType = t.getColumn().getBoard().getTaskType();
                    }
                    String key = t.getEffectiveTaskKey();
                    Board b = t.getColumn() != null ? t.getColumn().getBoard() : null;
                    Long boardId = b != null ? b.getId() : null;
                    String boardKey = b != null ? b.getEffectiveBoardKey() : "TASK";
                    String boardTitle = b != null ? b.getName() : "";
                    String colTitle = t.getColumn() != null ? t.getColumn().getTitle() : "";
                    String colorHex = effectiveType != null ? effectiveType.getColorHex() : null;
                    Set<String> tags = t.getTags() != null ? new HashSet<>(t.getTags()) : Set.of();

                    return new TaskSearchResultDto(
                            t.getId(),
                            key,
                            boardKey,
                            t.getTitle(),
                            boardId,
                            boardTitle,
                            colTitle,
                            t.getPriority() != null ? t.getPriority().name() : "MEDIUM",
                            colorHex,
                            tags
                    );
                })
                .toList();
    }
}
