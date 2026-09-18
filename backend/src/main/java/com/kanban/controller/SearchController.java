package com.kanban.controller;

import com.kanban.dto.search.GlobalSearchResponse;
import com.kanban.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for Global Search across tasks and boards.
 *
 * <pre>
 * GET /api/search?q={query} – returns matched tasks and boards
 * </pre>
 */
@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<GlobalSearchResponse> search(@RequestParam(name = "q", defaultValue = "") String query) {
        return ResponseEntity.ok(searchService.search(query));
    }
}
