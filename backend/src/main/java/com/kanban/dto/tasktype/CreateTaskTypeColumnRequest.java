package com.kanban.dto.tasktype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTaskTypeColumnRequest(
        Long id,

        @NotBlank(message = "Column title must not be blank")
        @Size(max = 100, message = "Column title must not exceed 100 characters")
        String title,

        @Size(max = 20, message = "Color hex must not exceed 20 characters")
        String colorHex,

        Integer position
) {}
