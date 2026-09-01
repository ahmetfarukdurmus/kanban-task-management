package com.kanban.dto.comment;

import java.time.Instant;

/**
 * Read-only view of a {@link com.kanban.entity.Comment}.
 *
 * @param id         comment identifier
 * @param content    comment body text
 * @param authorId   database id of the author
 * @param authorName username of the author
 * @param taskId     task this comment belongs to
 * @param createdAt  ISO-8601 timestamp of when the comment was posted
 */
public record CommentDto(
        Long    id,
        String  content,
        Long    authorId,
        String  authorName,
        Long    taskId,
        Instant createdAt
) {}
