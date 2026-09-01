package com.kanban.dto.comment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for creating a new comment.
 *
 * @param content comment text (1–5000 characters)
 */
public record CreateCommentRequest(

        @NotBlank(message = "Comment content must not be blank")
        @Size(max = 5000, message = "Comment content must not exceed 5000 characters")
        String content

) {}
