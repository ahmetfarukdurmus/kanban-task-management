package com.kanban.dto.tasktype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for creating or updating a dynamic custom field definition on a TaskType.
 */
public record CreateTaskTypeFieldRequest(
        Long id,

        @NotBlank(message = "Field name must not be blank")
        @Size(max = 100, message = "Field name must not exceed 100 characters")
        String fieldName,

        @Size(max = 20, message = "Field type must not exceed 20 characters")
        String fieldType,

        Boolean required,

        String options,

        @Size(max = 200, message = "Placeholder must not exceed 200 characters")
        String placeholder,

        Integer position
) {}
