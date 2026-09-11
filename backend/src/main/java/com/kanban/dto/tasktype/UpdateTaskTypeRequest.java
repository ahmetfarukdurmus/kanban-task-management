package com.kanban.dto.tasktype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request body for updating an existing {@link com.kanban.entity.TaskType}.
 */
public record UpdateTaskTypeRequest(
        @NotBlank(message = "Task type name must not be blank")
        @Size(max = 100, message = "Task type name must not exceed 100 characters")
        String name,

        @Size(max = 20, message = "Color hex code must not exceed 20 characters")
        String colorHex,

        Boolean requireTestDate,

        Boolean requireEnvironment,

        List<CreateTaskTypeColumnRequest> columns,

        List<CreateTransitionRuleRequest> rules
) {}
