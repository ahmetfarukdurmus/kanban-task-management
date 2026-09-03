package com.kanban.service;

import com.kanban.dto.task.CustomFieldDto;
import com.kanban.dto.task.MoveTaskRequest;
import com.kanban.dto.task.TaskRequest;
import com.kanban.dto.task.TaskResponse;
import com.kanban.entity.BoardColumn;
import com.kanban.entity.Task;
import com.kanban.entity.Task.Priority;
import com.kanban.entity.TaskCustomField;
import com.kanban.entity.TaskCustomField.FieldType;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.BoardColumnRepository;
import com.kanban.repository.BoardRepository;
import com.kanban.repository.TaskRepository;
import com.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Business logic for Task CRUD, custom fields, in-column reordering, cross-column moves,
 * and cross-department assignee mapping.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository        taskRepository;
    private final BoardColumnRepository columnRepository;
    private final BoardRepository       boardRepository;
    private final UserRepository        userRepository;

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

        User assignedUser = null;
        if (request.assignee() != null && !request.assignee().isBlank()) {
            assignedUser = userRepository.findByUsername(request.assignee().trim()).orElse(null);
        }

        Task task = Task.builder()
                .title(request.title())
                .description(request.description())
                .priority(request.priority() != null ? request.priority() : Priority.MEDIUM)
                .dueDate(request.dueDate())
                .assignee(request.assignee())
                .assignedUser(assignedUser)
                .position(nextPosition)
                .column(column)
                .comments(new ArrayList<>())
                .attachments(new ArrayList<>())
                .customFields(new ArrayList<>())
                .build();

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

        Task saved = taskRepository.save(task);
        taskRepository.flush();
        return toResponse(saved);
    }

    /**
     * Updates the fields and custom fields of an existing task.
     * Does NOT change position or column — use {@link #moveTask} for that.
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
        task.setAssignee(request.assignee());

        User assignedUser = null;
        if (request.assignee() != null && !request.assignee().isBlank()) {
            assignedUser = userRepository.findByUsername(request.assignee().trim()).orElse(null);
        }
        task.setAssignedUser(assignedUser);

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
        int  deletedPos = task.getPosition();

        taskRepository.delete(task);
        taskRepository.flush();   // flush DELETE before the UPDATE

        // Close gap: shift all tasks after deletedPos left by 1
        taskRepository.shiftPositionsLeft(columnId, deletedPos, Integer.MAX_VALUE);
        taskRepository.flush();
    }

    /**
     * Moves or reorders a task via the unified Kanban drag-and-drop endpoint.
     */
    public TaskResponse moveTask(Long taskId, MoveTaskRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));

        Long srcColId = task.getColumn().getId();
        int  srcPos   = task.getPosition();
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
                // Moving down: intermediate tasks shift left
                taskRepository.shiftPositionsLeft(srcColId, srcPos, clampedDst);
            } else {
                // Moving up: intermediate tasks shift right
                taskRepository.shiftPositionsRight(srcColId, clampedDst, srcPos);
            }
            task.setPosition(clampedDst);

        } else {
            // ── Case B: cross-column move ──────────────────────────────────
            BoardColumn targetColumn = columnRepository.findById(dstColId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Column", dstColId));

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

    private TaskResponse toResponse(Task task) {
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
