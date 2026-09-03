package com.kanban.controller;

import com.kanban.dto.comment.CommentDto;
import com.kanban.dto.comment.CreateCommentRequest;
import com.kanban.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Comment resources, nested under a Task.
 *
 * <pre>
 * GET    /api/tasks/{taskId}/comments              – list all comments (chronological)
 * POST   /api/tasks/{taskId}/comments              – add a comment (author = logged-in user)
 * DELETE /api/tasks/{taskId}/comments/{commentId}  – delete a comment
 * </pre>
 *
 * <p>Access policy: any authenticated user (ROLE_USER, ROLE_ADMIN or ROLE_SUPER_ADMIN) may
 * read and create comments.</p>
 */
@RestController
@RequestMapping("/tasks/{taskId}/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping
    public ResponseEntity<List<CommentDto>> listComments(@PathVariable Long taskId) {
        return ResponseEntity.ok(commentService.getComments(taskId));
    }

    @PostMapping
    public ResponseEntity<CommentDto> addComment(@PathVariable Long taskId,
                                                  @Valid @RequestBody CreateCommentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                             .body(commentService.addComment(taskId, request));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long taskId,
                                              @PathVariable Long commentId) {
        commentService.deleteComment(taskId, commentId);
        return ResponseEntity.noContent().build();
    }
}
