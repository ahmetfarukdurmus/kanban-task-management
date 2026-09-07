package com.kanban.controller;

import com.kanban.dto.task.*;
import com.kanban.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Task resources, move transitions, and checklist items.
 */
@RestController
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    // ── Nested CRUD ──────────────────────────────────────────────────────────

    @GetMapping("/boards/{boardId}/columns/{columnId}/tasks")
    public ResponseEntity<List<TaskResponse>> listTasks(@PathVariable Long boardId,
                                                        @PathVariable Long columnId) {
        return ResponseEntity.ok(taskService.getTasks(boardId, columnId));
    }

    @PostMapping("/boards/{boardId}/columns/{columnId}/tasks")
    public ResponseEntity<TaskResponse> createTask(@PathVariable Long boardId,
                                                   @PathVariable Long columnId,
                                                   @Valid @RequestBody TaskRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                             .body(taskService.createTask(boardId, columnId, request));
    }

    @GetMapping("/boards/{boardId}/columns/{columnId}/tasks/{taskId}")
    public ResponseEntity<TaskResponse> getTask(@PathVariable Long boardId,
                                                @PathVariable Long columnId,
                                                @PathVariable Long taskId) {
        return ResponseEntity.ok(taskService.getTask(boardId, columnId, taskId));
    }

    @PutMapping("/boards/{boardId}/columns/{columnId}/tasks/{taskId}")
    public ResponseEntity<TaskResponse> updateTask(@PathVariable Long boardId,
                                                   @PathVariable Long columnId,
                                                   @PathVariable Long taskId,
                                                   @Valid @RequestBody TaskRequest request) {
        return ResponseEntity.ok(taskService.updateTask(boardId, columnId, taskId, request));
    }

    @PutMapping("/tasks/{taskId}")
    public ResponseEntity<TaskResponse> updateTaskDirect(@PathVariable Long taskId,
                                                         @Valid @RequestBody TaskRequest request) {
        return ResponseEntity.ok(taskService.updateTaskDirect(taskId, request));
    }

    @DeleteMapping("/boards/{boardId}/columns/{columnId}/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long boardId,
                                           @PathVariable Long columnId,
                                           @PathVariable Long taskId) {
        taskService.deleteTask(boardId, columnId, taskId);
        return ResponseEntity.noContent().build();
    }

    // ── Move / Reorder ────────────────────────────────────────────────────────

    /**
     * Moves or reorders a task.
     * Enforces transition rules (checklist completion & required attachments) on cross-column moves.
     */
    @PatchMapping("/tasks/{taskId}/move")
    public ResponseEntity<TaskResponse> moveTask(@PathVariable Long taskId,
                                                 @Valid @RequestBody MoveTaskRequest request) {
        return ResponseEntity.ok(taskService.moveTask(taskId, request));
    }

    // ── Checklist Items ───────────────────────────────────────────────────────

    @PostMapping("/tasks/{taskId}/checklists")
    public ResponseEntity<TaskChecklistItemDto> addChecklistItem(
            @PathVariable Long taskId,
            @Valid @RequestBody CreateChecklistItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(taskService.addChecklistItem(taskId, request));
    }

    @PatchMapping("/tasks/{taskId}/checklists/{itemId}/toggle")
    public ResponseEntity<TaskChecklistItemDto> toggleChecklistItem(
            @PathVariable Long taskId,
            @PathVariable Long itemId) {
        return ResponseEntity.ok(taskService.toggleChecklistItem(taskId, itemId));
    }

    @PutMapping("/tasks/{taskId}/checklists/{itemId}")
    public ResponseEntity<TaskChecklistItemDto> updateChecklistItem(
            @PathVariable Long taskId,
            @PathVariable Long itemId,
            @Valid @RequestBody UpdateChecklistItemRequest request) {
        return ResponseEntity.ok(taskService.updateChecklistItem(taskId, itemId, request));
    }

    @DeleteMapping("/tasks/{taskId}/checklists/{itemId}")
    public ResponseEntity<Void> deleteChecklistItem(
            @PathVariable Long taskId,
            @PathVariable Long itemId) {
        taskService.deleteChecklistItem(taskId, itemId);
        return ResponseEntity.noContent().build();
    }
}
