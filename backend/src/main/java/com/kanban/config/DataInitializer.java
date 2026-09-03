package com.kanban.config;

import com.kanban.entity.Role;
import com.kanban.entity.User;
import com.kanban.repository.BoardRepository;
import com.kanban.repository.OrganizationRepository;
import com.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

/**
 * Initializes essential super admin accounts and cleans up legacy demo seed organizations.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final OrganizationRepository organizationRepository;
    private final UserRepository         userRepository;
    private final BoardRepository        boardRepository;
    private final PasswordEncoder        passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Running DataInitializer for initial superadmin account...");

        // 1. Clean up legacy seed demo organizations if they exist
        List.of("Muhasebe", "Uyum & Risk").forEach(orgName -> {
            organizationRepository.findByName(orgName).ifPresent(org -> {
                // Delete associated boards
                var boards = boardRepository.findAllByOrganizationIdOrderByCreatedAtDesc(org.getId());
                boardRepository.deleteAll(boards);
                boardRepository.flush();

                // Detach members
                var members = userRepository.findAllByOrganizationIdOrderByUsernameAsc(org.getId());
                for (User member : members) {
                    member.getOrganizations().remove(org);
                    userRepository.save(member);
                }
                userRepository.flush();

                organizationRepository.delete(org);
                organizationRepository.flush();
                log.info("Removed legacy seed organization: {}", orgName);
            });
        });

        // 2. Clean up legacy demo users if they exist
        List.of(
                "muhasebe_admin",
                "uyum_admin",
                "ahmet_muhasebe",
                "mehmet_muhasebe",
                "yunus_uyum",
                "elif_uyum"
        ).forEach(demoUsername -> {
            userRepository.findByUsername(demoUsername).ifPresent(user -> {
                userRepository.delete(user);
                log.info("Removed legacy seed demo user: {}", demoUsername);
            });
        });

        // 3. Seed Super Admin (Password: admin123)
        seedSuperAdmin("superadmin", "superadmin@kanban.local", "admin123");

        // Ensure legacy admin account is Super Admin with encoded password
        userRepository.findByUsername("admin").ifPresent(adminUser -> {
            adminUser.setRole(Role.ROLE_SUPER_ADMIN);
            if (adminUser.getOrganizations() != null) {
                adminUser.getOrganizations().clear();
            }
            adminUser.setPassword(passwordEncoder.encode("admin123"));
            userRepository.save(adminUser);
        });

        log.info("DataInitializer completed: Super Admin account initialized.");
    }

    private void seedSuperAdmin(String username, String email, String rawPassword) {
        userRepository.findByUsername(username).map(existing -> {
            existing.setEmail(email);
            existing.setPassword(passwordEncoder.encode(rawPassword));
            existing.setRole(Role.ROLE_SUPER_ADMIN);
            if (existing.getOrganizations() != null) {
                existing.getOrganizations().clear();
            }
            return userRepository.save(existing);
        }).orElseGet(() -> {
            User newUser = User.builder()
                    .username(username)
                    .email(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .role(Role.ROLE_SUPER_ADMIN)
                    .organizations(new HashSet<>())
                    .build();
            return userRepository.save(newUser);
        });
    }
}
