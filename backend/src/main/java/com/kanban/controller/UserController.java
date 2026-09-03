package com.kanban.controller;

import com.kanban.dto.user.UserSummaryDto;
import com.kanban.entity.Organization;
import com.kanban.entity.User;
import com.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing user information.
 * Returns all active company users so that tasks and department members can be managed smoothly.
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    /**
     * Returns all active users across departments for assignment and team listings.
     *
     * @return list of {@link UserSummaryDto}
     */
    @GetMapping
    public ResponseEntity<List<UserSummaryDto>> listUsers() {
        List<User> users = userRepository.findAllByOrderByUsernameAsc();

        List<UserSummaryDto> dtos = users.stream()
                .map(this::toUserSummaryDto)
                .toList();

        return ResponseEntity.ok(dtos);
    }

    private UserSummaryDto toUserSummaryDto(User u) {
        List<Long> orgIds = u.getOrganizations() != null
                ? u.getOrganizations().stream().map(Organization::getId).toList()
                : List.of();

        List<String> orgNames = u.getOrganizations() != null
                ? u.getOrganizations().stream().map(Organization::getName).toList()
                : List.of();

        String joinedOrgName = !orgNames.isEmpty() ? String.join(", ", orgNames) : null;
        Long primaryOrgId = !orgIds.isEmpty() ? orgIds.get(0) : null;

        return new UserSummaryDto(
                u.getId(),
                u.getUsername(),
                u.getEmail(),
                u.getRole() != null ? u.getRole().name() : "ROLE_USER",
                primaryOrgId,
                joinedOrgName,
                orgIds,
                orgNames,
                u.getCreatedAt()
        );
    }
}
