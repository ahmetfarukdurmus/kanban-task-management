package com.kanban.repository;

import com.kanban.entity.TaskChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskChecklistItemRepository extends JpaRepository<TaskChecklistItem, Long> {

    List<TaskChecklistItem> findAllByTaskIdOrderByIdAsc(Long taskId);
}
