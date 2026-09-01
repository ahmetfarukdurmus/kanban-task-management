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
 * GET  /api/tasks/{taskId}/comments   – list all comments (chronological)
 * POST /api/tasks/{taskId}/comments   – add a comment (author = logged-in user)
 * </pre>
 *
 * <p>Access policy: any authenticated user (ROLE_USER or ROLE_ADMIN) may
 * read and create comments.  This is enforced in {@code SecurityConfig}.</p>
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
}
