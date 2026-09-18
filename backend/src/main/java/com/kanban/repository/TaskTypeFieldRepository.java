package com.kanban.repository;

import com.kanban.entity.TaskTypeField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskTypeFieldRepository extends JpaRepository<TaskTypeField, Long> {
    List<TaskTypeField> findAllByTaskTypeIdOrderByPositionAsc(Long taskTypeId);
    void deleteAllByTaskTypeId(Long taskTypeId);
}
