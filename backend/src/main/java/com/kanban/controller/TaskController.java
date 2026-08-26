package com.kanban.controller;

import com.kanban.dto.task.MoveTaskRequest;
import com.kanban.dto.task.TaskRequest;
import com.kanban.dto.task.TaskResponse;
import com.kanban.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Task resources.
 *
 * <p>Standard CRUD is nested under board → column for clear ownership semantics.
 * The move/reorder endpoint lives at the top-level {@code /tasks} prefix because
 * it can change the owning column and does not naturally belong to either the
 * source or destination column path.</p>
 *
 * <pre>
 * GET    /api/boards/{boardId}/columns/{columnId}/tasks              – list tasks
 * POST   /api/boards/{boardId}/columns/{columnId}/tasks              – create task
 * GET    /api/boards/{boardId}/columns/{columnId}/tasks/{taskId}     – get task
 * PUT    /api/boards/{boardId}/columns/{columnId}/tasks/{taskId}     – update task
 * DELETE /api/boards/{boardId}/columns/{columnId}/tasks/{taskId}     – delete task
 *
 * PATCH  /api/tasks/{taskId}/move   – reorder within column OR move across columns
 * </pre>
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
     *
     * <p>If {@code targetColumnId} equals the task's current column, this is an
     * in-column reorder.  Otherwise it is a cross-column move.  Both cases are
     * handled atomically with the position-shift algorithm in
     * {@link TaskService#moveTask}.</p>
     *
     * <p>Request body example:</p>
     * <pre>{@code
     * {
     *   "targetColumnId": 3,
     *   "targetPosition": 1
     * }
     * }</pre>
     */
    @PatchMapping("/tasks/{taskId}/move")
    public ResponseEntity<TaskResponse> moveTask(@PathVariable Long taskId,
                                                 @Valid @RequestBody MoveTaskRequest request) {
        return ResponseEntity.ok(taskService.moveTask(taskId, request));
    }
}
