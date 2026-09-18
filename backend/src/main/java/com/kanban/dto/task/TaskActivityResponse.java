package com.kanban.dto.task;

import com.kanban.entity.TaskActivityType;
import java.time.LocalDateTime;

/**
 * DTO representing an audit log / activity record for a Task.
 */
public record TaskActivityResponse(
        Long id,
        Long taskId,
        Long userId,
        String username,
        String userRole,
        TaskActivityType activityType,
        String description,
        String oldValue,
        String newValue,
        LocalDateTime createdAt
) {}
