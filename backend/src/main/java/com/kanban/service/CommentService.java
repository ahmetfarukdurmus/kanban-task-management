package com.kanban.service;

import com.kanban.dto.comment.CommentDto;
import com.kanban.dto.comment.CreateCommentRequest;
import com.kanban.entity.Comment;
import com.kanban.entity.Role;
import com.kanban.entity.Task;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.CommentRepository;
import com.kanban.repository.TaskRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Business logic for the Comment resource.
 *
 * <p>Both reading and creating comments require an authenticated user.
 * The author is resolved from the {@link SecurityUtils} helper so the client
 * never needs to pass an {@code authorId} in the request body.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class CommentService {

    private final CommentRepository commentRepository;
    private final TaskRepository    taskRepository;
    private final SecurityUtils     securityUtils;

    /**
     * Returns all comments for the given task in chronological order.
     *
     * @param taskId task identifier
     * @return ordered list of comment DTOs
     * @throws ResourceNotFoundException if the task does not exist
     */
    @Transactional(readOnly = true)
    public List<CommentDto> getComments(Long taskId) {
        requireTask(taskId);
        return commentRepository.findAllByTaskIdOrderByCreatedAtAsc(taskId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Creates a new comment on the specified task.
     * The author is the currently authenticated user.
     *
     * @param taskId  task identifier
     * @param request validated comment payload
     * @return the persisted comment as a DTO
     * @throws ResourceNotFoundException if the task does not exist
     */
    public CommentDto addComment(Long taskId, CreateCommentRequest request) {
        Task task   = requireTask(taskId);
        User author = securityUtils.getCurrentUser();

        Comment comment = Comment.builder()
                .content(request.content())
                .author(author)
                .task(task)
                .build();

        return toDto(commentRepository.save(comment));
    }

    /**
     * Deletes a comment. Only the author or an admin may delete it.
     */
    public void deleteComment(Long taskId, Long commentId) {
        requireTask(taskId);
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> ResourceNotFoundException.of("Comment", commentId));

        User currentUser = securityUtils.getCurrentUser();
        boolean isAdmin = currentUser.getRole() == Role.ROLE_ADMIN || currentUser.getRole() == Role.ROLE_SUPER_ADMIN;
        boolean isAuthor = comment.getAuthor() != null && comment.getAuthor().getId().equals(currentUser.getId());

        if (!isAdmin && !isAuthor) {
            throw new IllegalArgumentException("Yalnızca yorum yazarı veya yönetici bu yorumu silebilir.");
        }

        commentRepository.delete(comment);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task requireTask(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));
    }

    private CommentDto toDto(Comment c) {
        return new CommentDto(
                c.getId(),
                c.getContent(),
                c.getAuthor().getId(),
                c.getAuthor().getUsername(),
                c.getTask().getId(),
                c.getCreatedAt());
    }
}
