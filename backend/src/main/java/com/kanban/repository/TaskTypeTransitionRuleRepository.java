package com.kanban.repository;

import com.kanban.entity.TaskTypeTransitionRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskTypeTransitionRuleRepository extends JpaRepository<TaskTypeTransitionRule, Long> {

    List<TaskTypeTransitionRule> findAllByTaskTypeId(Long taskTypeId);

    List<TaskTypeTransitionRule> findAllByTaskTypeIdAndTargetColumnId(Long taskTypeId, Long targetColumnId);
}
