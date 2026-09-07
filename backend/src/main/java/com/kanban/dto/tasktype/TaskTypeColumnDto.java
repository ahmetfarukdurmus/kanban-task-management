package com.kanban.dto.tasktype;

public record TaskTypeColumnDto(
        Long id,
        Long taskTypeId,
        String title,
        String colorHex,
        Integer position
) {}
