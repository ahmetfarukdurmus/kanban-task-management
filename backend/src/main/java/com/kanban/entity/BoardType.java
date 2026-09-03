package com.kanban.entity;

/**
 * Predefined board templates / types determining default column workflows.
 *
 * <ul>
 *   <li>{@link #STANDARD}    – To Do, In Progress, In Review, Done</li>
 *   <li>{@link #INTEGRATION} – Backlog, Analiz & Mapping, Geliştirme, Sandbox Test, Canlıya Alındı</li>
 *   <li>{@link #QA_TEST}     – Backlog, Geliştirme, Teste Hazır, Test Ediliyor, Tamamlandı</li>
 * </ul>
 */
public enum BoardType {
    STANDARD,
    INTEGRATION,
    QA_TEST
}
