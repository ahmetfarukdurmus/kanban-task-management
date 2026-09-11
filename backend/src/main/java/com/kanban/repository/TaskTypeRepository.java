package com.kanban.repository;

import com.kanban.entity.TaskType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskTypeRepository extends JpaRepository<TaskType, Long> {

    List<TaskType> findAllByOrganizationIdOrderByNameAsc(Long organizationId);

    List<TaskType> findAllByOrganizationIsNullOrderByNameAsc();

    List<TaskType> findAllByOrganizationIdInOrderByNameAsc(List<Long> organizationIds);

    Optional<TaskType> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByOrganizationIdAndNameIgnoreCase(Long organizationId, String name);
}
