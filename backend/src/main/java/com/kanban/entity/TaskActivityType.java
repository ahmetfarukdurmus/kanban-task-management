package com.kanban.entity;

/**
 * Categorizes the type of activity or mutation performed on a {@link Task}.
 */
public enum TaskActivityType {
    CREATED,
    STATUS_CHANGED,
    ASSIGNEE_CHANGED,
    PRIORITY_CHANGED,
    DUE_DATE_CHANGED,
    TITLE_UPDATED,
    DESCRIPTION_UPDATED,
    FIELD_UPDATED,
    CHECKLIST_UPDATED,
    ATTACHMENT_ADDED,
    ATTACHMENT_DELETED,
    COMMENT_ADDED
}
