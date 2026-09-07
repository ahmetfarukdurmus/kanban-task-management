package com.kanban.service;

import com.kanban.dto.tasktype.*;
import com.kanban.entity.*;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.*;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Service for managing dynamic task types and column transition rules.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class TaskTypeService {

    private final TaskTypeRepository               taskTypeRepository;
    private final TaskTypeTransitionRuleRepository transitionRuleRepository;
    private final OrganizationRepository           organizationRepository;
    private final BoardColumnRepository            columnRepository;
    private final TaskRepository                   taskRepository;
    private final SecurityUtils                    securityUtils;

    /**
     * Lists task types. If organizationId is passed, filters by that organization.
     * Otherwise returns all accessible task types for the authenticated user.
     */
    @Transactional(readOnly = true)
    public List<TaskTypeDto> getTaskTypes(Long organizationId) {
        User currentUser = securityUtils.getCurrentUser();
        boolean isSuperAdmin = currentUser.getRole() == Role.ROLE_SUPER_ADMIN;

        if (organizationId != null) {
            if (!isSuperAdmin && !isMemberOf(currentUser, organizationId)) {
                throw new AccessDeniedException("Bu organizasyonun görev tiplerini görüntüleme yetkiniz yok.");
            }
            return taskTypeRepository.findAllByOrganizationIdOrderByNameAsc(organizationId).stream()
                    .map(this::toDto)
                    .toList();
        }

        if (isSuperAdmin) {
            return taskTypeRepository.findAll().stream()
                    .map(this::toDto)
                    .toList();
        }

        List<Long> userOrgIds = currentUser.getOrganizations() != null
                ? currentUser.getOrganizations().stream().map(Organization::getId).toList()
                : List.of();

        List<TaskType> types = new ArrayList<>();
        for (Long orgId : userOrgIds) {
            types.addAll(taskTypeRepository.findAllByOrganizationIdOrderByNameAsc(orgId));
        }
        return types.stream().map(this::toDto).toList();
    }

    /**
     * Retrieves a single task type by ID.
     */
    @Transactional(readOnly = true)
    public TaskTypeDto getTaskType(Long id) {
        TaskType taskType = requireTaskType(id);
        User currentUser = securityUtils.getCurrentUser();
        validateAccess(currentUser, taskType);
        return toDto(taskType);
    }

    /**
     * Creates a new dynamic task type, optionally with initial transition rules.
     */
    public TaskTypeDto createTaskType(CreateTaskTypeRequest request) {
        User currentUser = securityUtils.getCurrentUser();
        Organization organization = null;

        if (request.organizationId() != null) {
            organization = organizationRepository.findById(request.organizationId())
                    .orElseThrow(() -> new ResourceNotFoundException("Organizasyon bulunamadı: ID " + request.organizationId()));
            validateAdminAccess(currentUser, organization.getId());
        } else if (currentUser.getRole() != Role.ROLE_SUPER_ADMIN) {
            // Assign primary organization if not super admin
            organization = currentUser.getOrganizations().stream().findFirst()
                    .orElseThrow(() -> new AccessDeniedException("Bağlı olduğunuz bir organizasyon bulunmamaktadır."));
        }

        TaskType taskType = TaskType.builder()
                .name(request.name().trim())
                .colorHex(request.colorHex() != null ? request.colorHex().trim() : null)
                .organization(organization)
                .rules(new ArrayList<>())
                .build();

        if (request.rules() != null && !request.rules().isEmpty()) {
            for (CreateTransitionRuleRequest ruleReq : request.rules()) {
                BoardColumn targetColumn = columnRepository.findById(ruleReq.targetColumnId())
                        .orElseThrow(() -> new ResourceNotFoundException("Hedef kolon bulunamadı: ID " + ruleReq.targetColumnId()));

                TaskTypeTransitionRule rule = TaskTypeTransitionRule.builder()
                        .taskType(taskType)
                        .targetColumn(targetColumn)
                        .ruleType(ruleReq.ruleType())
                        .description(ruleReq.description() != null ? ruleReq.description().trim() : null)
                        .build();

                taskType.getRules().add(rule);
            }
        }

        TaskType saved = taskTypeRepository.save(taskType);
        log.info("Created TaskType '{}' (ID: {}) for organization '{}'",
                saved.getName(), saved.getId(), organization != null ? organization.getName() : "Global");
        return toDto(saved);
    }

    /**
     * Updates an existing task type and its transition rules.
     */
    public TaskTypeDto updateTaskType(Long id, UpdateTaskTypeRequest request) {
        TaskType taskType = requireTaskType(id);
        User currentUser = securityUtils.getCurrentUser();
        if (taskType.getOrganization() != null) {
            validateAdminAccess(currentUser, taskType.getOrganization().getId());
        } else if (currentUser.getRole() != Role.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Bu görev tipini düzenleme yetkiniz yok.");
        }

        taskType.setName(request.name().trim());
        if (request.colorHex() != null) {
            taskType.setColorHex(request.colorHex().trim());
        }

        if (request.rules() != null) {
            taskType.getRules().clear();
            for (CreateTransitionRuleRequest ruleReq : request.rules()) {
                BoardColumn targetColumn = columnRepository.findById(ruleReq.targetColumnId())
                        .orElseThrow(() -> new ResourceNotFoundException("Hedef kolon bulunamadı: ID " + ruleReq.targetColumnId()));

                TaskTypeTransitionRule rule = TaskTypeTransitionRule.builder()
                        .taskType(taskType)
                        .targetColumn(targetColumn)
                        .ruleType(ruleReq.ruleType())
                        .description(ruleReq.description() != null ? ruleReq.description().trim() : null)
                        .build();

                taskType.getRules().add(rule);
            }
        }

        TaskType saved = taskTypeRepository.save(taskType);
        return toDto(saved);
    }

    /**
     * Deletes a task type.
     */
    public void deleteTaskType(Long id) {
        TaskType taskType = requireTaskType(id);
        User currentUser = securityUtils.getCurrentUser();
        if (taskType.getOrganization() != null) {
            validateAdminAccess(currentUser, taskType.getOrganization().getId());
        } else if (currentUser.getRole() != Role.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Bu görev tipini silme yetkiniz yok.");
        }

        // Nullify reference on existing tasks
        List<Task> associatedTasks = taskRepository.findAll().stream()
                .filter(t -> t.getTaskType() != null && t.getTaskType().getId().equals(id))
                .toList();
        for (Task task : associatedTasks) {
            task.setTaskType(null);
            taskRepository.save(task);
        }
        taskRepository.flush();

        taskTypeRepository.delete(taskType);
        log.info("Deleted TaskType ID: {}", id);
    }

    /**
     * Adds a single transition rule to a task type.
     */
    public TaskTypeTransitionRuleDto addRule(Long taskTypeId, CreateTransitionRuleRequest request) {
        TaskType taskType = requireTaskType(taskTypeId);
        User currentUser = securityUtils.getCurrentUser();
        if (taskType.getOrganization() != null) {
            validateAdminAccess(currentUser, taskType.getOrganization().getId());
        }

        BoardColumn targetColumn = columnRepository.findById(request.targetColumnId())
                .orElseThrow(() -> new ResourceNotFoundException("Hedef kolon bulunamadı: ID " + request.targetColumnId()));

        TaskTypeTransitionRule rule = TaskTypeTransitionRule.builder()
                .taskType(taskType)
                .targetColumn(targetColumn)
                .ruleType(request.ruleType())
                .description(request.description() != null ? request.description().trim() : null)
                .build();

        TaskTypeTransitionRule saved = transitionRuleRepository.save(rule);
        return new TaskTypeTransitionRuleDto(
                saved.getId(),
                taskType.getId(),
                targetColumn.getId(),
                targetColumn.getTitle(),
                saved.getRuleType(),
                saved.getDescription());
    }

    /**
     * Deletes a transition rule.
     */
    public void deleteRule(Long taskTypeId, Long ruleId) {
        TaskType taskType = requireTaskType(taskTypeId);
        User currentUser = securityUtils.getCurrentUser();
        if (taskType.getOrganization() != null) {
            validateAdminAccess(currentUser, taskType.getOrganization().getId());
        }

        TaskTypeTransitionRule rule = transitionRuleRepository.findById(ruleId)
                .orElseThrow(() -> new ResourceNotFoundException("Geçiş kuralı bulunamadı: ID " + ruleId));

        if (!rule.getTaskType().getId().equals(taskTypeId)) {
            throw new IllegalArgumentException("Kural bu görev tipine ait değil.");
        }

        transitionRuleRepository.delete(rule);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private TaskType requireTaskType(Long id) {
        return taskTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Görev tipi bulunamadı: ID " + id));
    }

    private boolean isMemberOf(User user, Long organizationId) {
        if (user.getOrganizations() == null) return false;
        return user.getOrganizations().stream().anyMatch(org -> org.getId().equals(organizationId));
    }

    private void validateAccess(User user, TaskType taskType) {
        if (user.getRole() == Role.ROLE_SUPER_ADMIN) return;
        if (taskType.getOrganization() != null && !isMemberOf(user, taskType.getOrganization().getId())) {
            throw new AccessDeniedException("Bu görev tipine erişim yetkiniz yok.");
        }
    }

    private void validateAdminAccess(User user, Long organizationId) {
        if (user.getRole() == Role.ROLE_SUPER_ADMIN) return;
        if (user.getRole() != Role.ROLE_ADMIN || !isMemberOf(user, organizationId)) {
            throw new AccessDeniedException("Bu organizasyonda yönetici yetkiniz bulunmamaktadır.");
        }
    }

    public TaskTypeDto toDto(TaskType type) {
        List<TaskTypeTransitionRuleDto> ruleDtos = type.getRules() != null
                ? type.getRules().stream()
                        .map(r -> new TaskTypeTransitionRuleDto(
                                r.getId(),
                                type.getId(),
                                r.getTargetColumn().getId(),
                                r.getTargetColumn().getTitle(),
                                r.getRuleType(),
                                r.getDescription()))
                        .toList()
                : List.of();

        return new TaskTypeDto(
                type.getId(),
                type.getName(),
                type.getColorHex(),
                type.getOrganization() != null ? type.getOrganization().getId() : null,
                type.getOrganization() != null ? type.getOrganization().getName() : null,
                ruleDtos,
                type.getCreatedAt());
    }
}
