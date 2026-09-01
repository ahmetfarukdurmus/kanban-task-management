package com.kanban.repository;

import com.kanban.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    /**
     * Returns all comments for the given task in chronological (posting) order.
     *
     * @param taskId the task's primary key
     * @return ordered list of comments, oldest first
     */
    List<Comment> findAllByTaskIdOrderByCreatedAtAsc(Long taskId);
}
