package com.kanban.service;

import com.kanban.dto.organization.CreateOrganizationRequest;
import com.kanban.dto.organization.OrganizationDto;
import com.kanban.entity.Organization;
import com.kanban.entity.Role;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.OrganizationRepository;
import com.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Service managing Organization resources, department administrator assignments, and team members.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final UserRepository         userRepository;
    private final PasswordEncoder        passwordEncoder;

    @Transactional(readOnly = true)
    public List<OrganizationDto> getAllOrganizations() {
        return organizationRepository.findAllByOrderByNameAsc().stream()
                .map(o -> new OrganizationDto(o.getId(), o.getName(), o.getDescription()))
                .toList();
    }

    /**
     * Creates a new organization, and optionally assigns a department administrator
     * and one or more initial team members.
     */
    @Transactional
    public OrganizationDto createOrganization(CreateOrganizationRequest request) {
        String orgName = request.name().trim();
        if (organizationRepository.findByName(orgName).isPresent()) {
            throw new IllegalArgumentException("Bu isimde bir departman zaten mevcut: " + orgName);
        }

        Organization organization = Organization.builder()
                .name(orgName)
                .description(request.description() != null ? request.description().trim() : null)
                .build();
        Organization savedOrg = organizationRepository.save(organization);
        log.info("Created new organization: '{}' (ID: {})", savedOrg.getName(), savedOrg.getId());

        // 1. Assign existing user as department admin if adminUserId provided
        if (request.adminUserId() != null) {
            User existingUser = userRepository.findById(request.adminUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Seçilen yönetici kullanıcı bulunamadı: ID " + request.adminUserId()));

            existingUser.setOrganization(savedOrg);
            existingUser.setRole(Role.ROLE_ADMIN);
            userRepository.save(existingUser);
            log.info("Assigned existing user '{}' as admin for organization '{}'", existingUser.getUsername(), savedOrg.getName());
        }
        // 2. Or provision a new administrator user if newAdmin provided
        else if (request.newAdmin() != null && request.newAdmin().username() != null && !request.newAdmin().username().isBlank()) {
            CreateOrganizationRequest.NewAdminDto adminDto = request.newAdmin();
            String username = adminDto.username().trim();
            String email = (adminDto.email() != null && !adminDto.email().isBlank())
                    ? adminDto.email().trim()
                    : username + "@kanban.local";
            String rawPassword = (adminDto.password() != null && !adminDto.password().isBlank())
                    ? adminDto.password()
                    : "admin123";

            if (userRepository.existsByUsername(username)) {
                throw new IllegalArgumentException("Yönetici kullanıcı adı zaten kullanımda: " + username);
            }
            if (userRepository.existsByEmail(email)) {
                throw new IllegalArgumentException("Yönetici e-posta adresi zaten kullanımda: " + email);
            }

            User newAdminUser = User.builder()
                    .username(username)
                    .email(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .role(Role.ROLE_ADMIN)
                    .organization(savedOrg)
                    .build();
            userRepository.save(newAdminUser);
            log.info("Created new admin user '{}' for organization '{}'", username, savedOrg.getName());
        }

        // 3. Assign multiple existing users as team members if memberUserIds provided
        List<Long> memberIds = new ArrayList<>();
        if (request.memberUserIds() != null && !request.memberUserIds().isEmpty()) {
            memberIds.addAll(request.memberUserIds());
        } else if (request.initialUserId() != null) {
            memberIds.add(request.initialUserId());
        }

        for (Long memberId : memberIds) {
            // Avoid overriding newly assigned admin role if same user selected
            if (request.adminUserId() != null && request.adminUserId().equals(memberId)) {
                continue;
            }

            userRepository.findById(memberId).ifPresent(user -> {
                user.setOrganization(savedOrg);
                if (user.getRole() != Role.ROLE_ADMIN && user.getRole() != Role.ROLE_SUPER_ADMIN) {
                    user.setRole(Role.ROLE_USER);
                }
                userRepository.save(user);
                log.info("Assigned existing user '{}' as team member for organization '{}'", user.getUsername(), savedOrg.getName());
            });
        }

        // 4. Or provision a new team member if newUser provided
        if (request.newUser() != null && request.newUser().username() != null && !request.newUser().username().isBlank()) {
            CreateOrganizationRequest.NewUserDto userDto = request.newUser();
            String username = userDto.username().trim();
            String email = (userDto.email() != null && !userDto.email().isBlank())
                    ? userDto.email().trim()
                    : username + "@kanban.local";
            String rawPassword = (userDto.password() != null && !userDto.password().isBlank())
                    ? userDto.password()
                    : "user123";

            if (userRepository.existsByUsername(username)) {
                throw new IllegalArgumentException("Ekip üyesi kullanıcı adı zaten kullanımda: " + username);
            }
            if (userRepository.existsByEmail(email)) {
                throw new IllegalArgumentException("Ekip üyesi e-posta adresi zaten kullanımda: " + email);
            }

            User newMemberUser = User.builder()
                    .username(username)
                    .email(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .role(Role.ROLE_USER)
                    .organization(savedOrg)
                    .build();
            userRepository.save(newMemberUser);
            log.info("Created new team member '{}' for organization '{}'", username, savedOrg.getName());
        }

        return new OrganizationDto(savedOrg.getId(), savedOrg.getName(), savedOrg.getDescription());
    }

    /**
     * Assigns existing users to an existing organization.
     */
    @Transactional
    public void assignMembersToOrganization(Long organizationId, List<Long> userIds) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Departman bulunamadı: ID " + organizationId));

        if (userIds != null && !userIds.isEmpty()) {
            List<User> users = userRepository.findAllById(userIds);
            for (User user : users) {
                user.setOrganization(organization);
                if (user.getRole() != Role.ROLE_ADMIN && user.getRole() != Role.ROLE_SUPER_ADMIN) {
                    user.setRole(Role.ROLE_USER);
                }
                userRepository.save(user);
                log.info("Assigned user '{}' to organization '{}'", user.getUsername(), organization.getName());
            }
        }
    }
}
