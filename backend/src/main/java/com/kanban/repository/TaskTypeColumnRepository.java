package com.kanban.repository;

import com.kanban.entity.TaskTypeColumn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskTypeColumnRepository extends JpaRepository<TaskTypeColumn, Long> {

    List<TaskTypeColumn> findAllByTaskTypeIdOrderByPositionAsc(Long taskTypeId);
}
