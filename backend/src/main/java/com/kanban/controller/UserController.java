package com.kanban.controller;

import com.kanban.dto.user.UserSummaryDto;
import com.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing basic user information.
 *
 * <pre>
 * GET /api/users  – list all registered users (for assignee selection)
 * </pre>
 *
 * <p>Access policy: any authenticated user may call this endpoint.
 * No sensitive data (password hash, role) is included in the response.</p>
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    /**
     * Returns a summary of all registered users sorted alphabetically by username.
     * Intended for populating assignee dropdowns in the frontend.
     *
     * @return list of {@link UserSummaryDto}
     */
    @GetMapping
    public ResponseEntity<List<UserSummaryDto>> listUsers() {
        List<UserSummaryDto> users = userRepository.findAllByOrderByUsernameAsc()
                .stream()
                .map(u -> new UserSummaryDto(u.getId(), u.getUsername(), u.getEmail()))
                .toList();
        return ResponseEntity.ok(users);
    }
}
