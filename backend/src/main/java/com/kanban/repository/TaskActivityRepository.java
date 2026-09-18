package com.kanban.repository;

import com.kanban.entity.TaskActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data JPA repository for {@link TaskActivity}.
 */
@Repository
public interface TaskActivityRepository extends JpaRepository<TaskActivity, Long> {

    List<TaskActivity> findAllByTaskIdOrderByCreatedAtDesc(Long taskId);
}
