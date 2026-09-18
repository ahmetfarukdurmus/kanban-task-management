package com.kanban.service;

import com.kanban.dto.task.TaskActivityResponse;
import com.kanban.entity.Task;
import com.kanban.entity.TaskActivity;
import com.kanban.entity.TaskActivityType;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.TaskActivityRepository;
import com.kanban.repository.TaskRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service managing Task audit activities and change history.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class TaskActivityService {

    private final TaskActivityRepository activityRepository;
    private final TaskRepository         taskRepository;
    private final SecurityUtils          securityUtils;

    /**
     * Records a new activity log entry for the given task using the current authenticated user as actor.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public TaskActivity recordActivity(Task task, TaskActivityType type, String description, String oldValue, String newValue) {
        User actor = null;
        try {
            actor = securityUtils.getCurrentUser();
        } catch (Exception e) {
            // Unauthenticated or system execution fallback
            if (task.getReporter() != null) {
                actor = task.getReporter();
            }
        }

        return recordActivity(task, actor, type, description, oldValue, newValue);
    }

    /**
     * Records an activity log entry explicitly specifying the actor.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public TaskActivity recordActivity(Task task, User actor, TaskActivityType type, String description, String oldValue, String newValue) {
        if (task == null) {
            return null;
        }

        TaskActivity activity = TaskActivity.builder()
                .task(task)
                .user(actor)
                .activityType(type)
                .description(description)
                .oldValue(oldValue)
                .newValue(newValue)
                .build();

        return activityRepository.save(activity);
    }

    /**
     * Returns all activities for a given task, sorted from newest to oldest.
     */
    @Transactional(readOnly = true)
    public List<TaskActivityResponse> getActivities(Long taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw ResourceNotFoundException.of("Task", taskId);
        }

        return activityRepository.findAllByTaskIdOrderByCreatedAtDesc(taskId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private TaskActivityResponse toResponse(TaskActivity activity) {
        User u = activity.getUser();
        return new TaskActivityResponse(
                activity.getId(),
                activity.getTask().getId(),
                u != null ? u.getId() : null,
                u != null ? u.getUsername() : (activity.getTask().getReporter() != null ? activity.getTask().getReporter().getUsername() : "Sistem"),
                u != null && u.getRole() != null ? u.getRole().name() : null,
                activity.getActivityType(),
                activity.getDescription(),
                activity.getOldValue(),
                activity.getNewValue(),
                activity.getCreatedAt()
        );
    }
}
