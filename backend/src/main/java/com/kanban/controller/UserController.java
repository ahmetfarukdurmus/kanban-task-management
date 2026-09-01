package com.kanban.controller;

import com.kanban.dto.user.UserSummaryDto;
import com.kanban.entity.Role;
import com.kanban.entity.User;
import com.kanban.repository.UserRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing user information.
 *
 * <p>Super Admin sees all users across the entire company.
 * Department users (Admin & Member) see only colleagues within their own Department.</p>
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final SecurityUtils  securityUtils;

    /**
     * Returns a summary of users:
     * - For Super Admin: all users across all departments.
     * - For Department Users: only colleagues in the caller's department.
     *
     * @return list of {@link UserSummaryDto}
     */
    @GetMapping
    public ResponseEntity<List<UserSummaryDto>> listUsers() {
        User currentUser = securityUtils.getCurrentUser();
        boolean isSuperAdmin = currentUser.getRole() == Role.ROLE_ADMIN && currentUser.getOrganization() == null;

        List<User> users;
        if (isSuperAdmin) {
            users = userRepository.findAllByOrderByUsernameAsc();
        } else {
            Long orgId = currentUser.getOrganization() != null ? currentUser.getOrganization().getId() : null;
            if (orgId != null) {
                users = userRepository.findAllByOrganizationIdOrderByUsernameAsc(orgId);
            } else {
                users = userRepository.findAllByOrderByUsernameAsc();
            }
        }

        List<UserSummaryDto> dtos = users.stream()
                .map(u -> new UserSummaryDto(
                        u.getId(),
                        u.getUsername(),
                        u.getEmail(),
                        u.getOrganization() != null ? u.getOrganization().getId() : null,
                        u.getOrganization() != null ? u.getOrganization().getName() : null))
                .toList();

        return ResponseEntity.ok(dtos);
    }
}
