package com.kanban.controller;

import com.kanban.dto.tasktype.*;
import com.kanban.service.TaskTypeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for managing dynamic task types and column transition rules.
 */
@RestController
@RequestMapping("/task-types")
@RequiredArgsConstructor
public class TaskTypeController {

    private final TaskTypeService taskTypeService;

    @GetMapping
    public ResponseEntity<List<TaskTypeDto>> listTaskTypes(
            @RequestParam(required = false) Long organizationId) {
        return ResponseEntity.ok(taskTypeService.getTaskTypes(organizationId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskTypeDto> getTaskType(@PathVariable Long id) {
        return ResponseEntity.ok(taskTypeService.getTaskType(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TaskTypeDto> createTaskType(
            @Valid @RequestBody CreateTaskTypeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(taskTypeService.createTaskType(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TaskTypeDto> updateTaskType(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTaskTypeRequest request) {
        return ResponseEntity.ok(taskTypeService.updateTaskType(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Void> deleteTaskType(@PathVariable Long id) {
        taskTypeService.deleteTaskType(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/rules")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<TaskTypeTransitionRuleDto> addRule(
            @PathVariable Long id,
            @Valid @RequestBody CreateTransitionRuleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(taskTypeService.addRule(id, request));
    }

    @DeleteMapping("/{id}/rules/{ruleId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Void> deleteRule(
            @PathVariable Long id,
            @PathVariable Long ruleId) {
        taskTypeService.deleteRule(id, ruleId);
        return ResponseEntity.noContent().build();
    }
}
