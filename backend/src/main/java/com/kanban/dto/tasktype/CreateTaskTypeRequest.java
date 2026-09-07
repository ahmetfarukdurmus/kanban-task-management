package com.kanban.dto.tasktype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request body for creating a new {@link com.kanban.entity.TaskType}.
 */
public record CreateTaskTypeRequest(
        @NotBlank(message = "Task type name must not be blank")
        @Size(max = 100, message = "Task type name must not exceed 100 characters")
        String name,

        @Size(max = 20, message = "Color hex code must not exceed 20 characters")
        String colorHex,

        Long organizationId,

        List<CreateTransitionRuleRequest> rules
) {}
