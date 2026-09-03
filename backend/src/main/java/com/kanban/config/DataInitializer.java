package com.kanban.config;

import com.kanban.entity.Organization;
import com.kanban.entity.Role;
import com.kanban.entity.User;
import com.kanban.repository.OrganizationRepository;
import com.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Seeds the database on startup with default departments and user accounts.
 * Always hashes passwords with BCrypt PasswordEncoder on creation and update.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final OrganizationRepository organizationRepository;
    private final UserRepository         userRepository;
    private final PasswordEncoder        passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Running DataInitializer for seed departments and accounts...");

        // 1. Seed Departments (Organizations)
        Organization muhasebe = organizationRepository.findByName("Muhasebe")
                .orElseGet(() -> organizationRepository.save(Organization.builder()
                        .name("Muhasebe")
                        .description("Mali İşler ve Muhasebe Departmanı")
                        .createdAt(LocalDateTime.now())
                        .build()));

        Organization uyumRisk = organizationRepository.findByName("Uyum & Risk")
                .orElseGet(() -> organizationRepository.save(Organization.builder()
                        .name("Uyum & Risk")
                        .description("Yasal Uyum ve Risk Yönetimi Departmanı")
                        .createdAt(LocalDateTime.now())
                        .build()));

        // 2. Seed Admins (Password: admin123)
        seedUser("superadmin", "superadmin@kanban.local", "admin123", Role.ROLE_SUPER_ADMIN, null);
        seedUser("muhasebe_admin", "muhasebe_admin@kanban.local", "admin123", Role.ROLE_ADMIN, muhasebe);
        seedUser("uyum_admin", "uyum_admin@kanban.local", "admin123", Role.ROLE_ADMIN, uyumRisk);

        // Ensure legacy admin account is Super Admin with encoded password
        userRepository.findByUsername("admin").ifPresent(adminUser -> {
            adminUser.setRole(Role.ROLE_SUPER_ADMIN);
            adminUser.setOrganization(null);
            adminUser.setPassword(passwordEncoder.encode("admin123"));
            userRepository.save(adminUser);
        });

        // 3. Seed Team Members (Password: user123)
        seedUser("ahmet_muhasebe", "ahmet_muhasebe@kanban.local", "user123", Role.ROLE_USER, muhasebe);
        seedUser("mehmet_muhasebe", "mehmet_muhasebe@kanban.local", "user123", Role.ROLE_USER, muhasebe);
        seedUser("yunus_uyum", "yunus_uyum@kanban.local", "user123", Role.ROLE_USER, uyumRisk);
        seedUser("elif_uyum", "elif_uyum@kanban.local", "user123", Role.ROLE_USER, uyumRisk);

        log.info("DataInitializer completed: seeded 2 departments and 7 users with BCrypt encoded passwords.");
    }

    private User seedUser(String username, String email, String rawPassword, Role role, Organization org) {
        return userRepository.findByUsername(username).map(existing -> {
            existing.setEmail(email);
            existing.setPassword(passwordEncoder.encode(rawPassword));
            existing.setRole(role);
            existing.setOrganization(org);
            return userRepository.save(existing);
        }).orElseGet(() -> userRepository.save(User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .role(role)
                .organization(org)
                .build()));
    }
}
