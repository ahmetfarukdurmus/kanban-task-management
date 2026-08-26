package com.kanban.controller;

import com.kanban.dto.column.ColumnRequest;
import com.kanban.dto.column.ColumnReorderRequest;
import com.kanban.dto.column.ColumnResponse;
import com.kanban.service.BoardColumnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for BoardColumn resources, nested under a Board.
 *
 * <pre>
 * GET    /api/boards/{boardId}/columns                          – list columns with tasks
 * POST   /api/boards/{boardId}/columns                          – add a column
 * GET    /api/boards/{boardId}/columns/{columnId}               – get single column
 * PUT    /api/boards/{boardId}/columns/{columnId}               – rename column
 * DELETE /api/boards/{boardId}/columns/{columnId}               – delete column + tasks
 * PATCH  /api/boards/{boardId}/columns/{columnId}/reorder       – change column position
 * </pre>
 */
@RestController
@RequestMapping("/boards/{boardId}/columns")
@RequiredArgsConstructor
public class BoardColumnController {

    private final BoardColumnService columnService;

    @GetMapping
    public ResponseEntity<List<ColumnResponse>> listColumns(@PathVariable Long boardId) {
        return ResponseEntity.ok(columnService.getColumns(boardId));
    }

    @PostMapping
    public ResponseEntity<ColumnResponse> createColumn(@PathVariable Long boardId,
                                                       @Valid @RequestBody ColumnRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                             .body(columnService.createColumn(boardId, request));
    }

    @GetMapping("/{columnId}")
    public ResponseEntity<ColumnResponse> getColumn(@PathVariable Long boardId,
                                                    @PathVariable Long columnId) {
        return ResponseEntity.ok(columnService.getColumn(boardId, columnId));
    }

    @PutMapping("/{columnId}")
    public ResponseEntity<ColumnResponse> updateColumn(@PathVariable Long boardId,
                                                       @PathVariable Long columnId,
                                                       @Valid @RequestBody ColumnRequest request) {
        return ResponseEntity.ok(columnService.updateColumn(boardId, columnId, request));
    }

    @DeleteMapping("/{columnId}")
    public ResponseEntity<Void> deleteColumn(@PathVariable Long boardId,
                                             @PathVariable Long columnId) {
        columnService.deleteColumn(boardId, columnId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Changes the display order of a column within its board.
     * Body: {@code { "newPosition": 2 }}
     */
    @PatchMapping("/{columnId}/reorder")
    public ResponseEntity<ColumnResponse> reorderColumn(@PathVariable Long boardId,
                                                        @PathVariable Long columnId,
                                                        @Valid @RequestBody ColumnReorderRequest request) {
        return ResponseEntity.ok(columnService.reorderColumn(boardId, columnId, request.newPosition()));
    }
}
