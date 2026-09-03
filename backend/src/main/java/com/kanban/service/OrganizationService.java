package com.kanban.service;

import com.kanban.dto.organization.CreateNewMemberRequest;
import com.kanban.dto.organization.CreateOrganizationRequest;
import com.kanban.dto.organization.OrganizationDto;
import com.kanban.dto.user.UserSummaryDto;
import com.kanban.entity.Board;
import com.kanban.entity.Organization;
import com.kanban.entity.Role;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.BoardRepository;
import com.kanban.repository.OrganizationRepository;
import com.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/**
 * Service managing Organization resources, department administrator assignments, ManyToMany team members, and cascade deletion.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final UserRepository         userRepository;
    private final BoardRepository        boardRepository;
    private final PasswordEncoder        passwordEncoder;

    @Transactional(readOnly = true)
    public List<OrganizationDto> getAllOrganizations() {
        return organizationRepository.findAllByOrderByNameAsc().stream()
                .map(o -> new OrganizationDto(o.getId(), o.getName(), o.getDescription()))
                .toList();
    }

    /**
     * Returns all members belonging to a specific department.
     */
    @Transactional(readOnly = true)
    public List<UserSummaryDto> getOrganizationMembers(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Departman bulunamadı: ID " + organizationId));

        List<User> members = userRepository.findAllByOrganizationIdOrderByUsernameAsc(organizationId);

        return members.stream()
                .map(this::toUserSummaryDto)
                .toList();
    }

    /**
     * Creates a new organization, and optionally assigns a department administrator
     * and one or more initial team members (without removing them from previous departments).
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

            existingUser.getOrganizations().add(savedOrg);
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
                    .organizations(new HashSet<>(List.of(savedOrg)))
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
            if (request.adminUserId() != null && request.adminUserId().equals(memberId)) {
                continue;
            }

            userRepository.findById(memberId).ifPresent(user -> {
                user.getOrganizations().add(savedOrg);
                if (user.getRole() != Role.ROLE_ADMIN && user.getRole() != Role.ROLE_SUPER_ADMIN) {
                    user.setRole(Role.ROLE_USER);
                }
                userRepository.save(user);
                log.info("Assigned existing user '{}' to organization '{}'", user.getUsername(), savedOrg.getName());
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
                    .organizations(new HashSet<>(List.of(savedOrg)))
                    .build();
            userRepository.save(newMemberUser);
            log.info("Created new team member '{}' for organization '{}'", username, savedOrg.getName());
        }

        return new OrganizationDto(savedOrg.getId(), savedOrg.getName(), savedOrg.getDescription());
    }

    /**
     * Adds existing users to an organization without removing them from previous departments.
     */
    @Transactional
    public void addExistingMembers(Long organizationId, List<Long> userIds) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Departman bulunamadı: ID " + organizationId));

        if (userIds != null && !userIds.isEmpty()) {
            List<User> users = userRepository.findAllById(userIds);
            for (User user : users) {
                user.getOrganizations().add(organization);
                if (user.getRole() != Role.ROLE_ADMIN && user.getRole() != Role.ROLE_SUPER_ADMIN) {
                    user.setRole(Role.ROLE_USER);
                }
                userRepository.save(user);
                log.info("Added user '{}' to organization '{}' (ManyToMany)", user.getUsername(), organization.getName());
            }
        }
    }

    /**
     * Creates a brand new user and directly attaches them to the organization.
     */
    @Transactional
    public UserSummaryDto createNewMember(Long organizationId, CreateNewMemberRequest request) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Departman bulunamadı: ID " + organizationId));

        String username = request.username().trim();
        String email = (request.email() != null && !request.email().isBlank())
                ? request.email().trim()
                : username + "@kanban.local";
        String rawPassword = (request.password() != null && !request.password().isBlank())
                ? request.password()
                : "user123";

        Role assignedRole = Role.ROLE_USER;
        if ("ROLE_ADMIN".equalsIgnoreCase(request.role()) || "ADMIN".equalsIgnoreCase(request.role())) {
            assignedRole = Role.ROLE_ADMIN;
        }

        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Kullanıcı adı zaten kullanımda: " + username);
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("E-posta adresi zaten kullanımda: " + email);
        }

        User newUser = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .role(assignedRole)
                .organizations(new HashSet<>(List.of(organization)))
                .build();

        User savedUser = userRepository.save(newUser);
        log.info("Created new member '{}' and attached to organization '{}'", username, organization.getName());
        return toUserSummaryDto(savedUser);
    }

    /**
     * Removes a user from a specific organization.
     */
    @Transactional
    public void removeMemberFromOrganization(Long organizationId, Long userId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Departman bulunamadı: ID " + organizationId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: ID " + userId));

        user.getOrganizations().remove(organization);
        userRepository.save(user);
        log.info("Removed user '{}' from organization '{}'", user.getUsername(), organization.getName());
    }

    /**
     * Deletes an organization, cascading all its boards, tasks, columns, and detaching all user memberships.
     */
    @Transactional
    public void deleteOrganization(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Departman bulunamadı: ID " + organizationId));

        // 1. Delete all boards belonging to this organization (cascades columns, tasks, comments, attachments)
        List<Board> boards = boardRepository.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId);
        for (Board board : boards) {
            boardRepository.delete(board);
            log.info("Deleted board '{}' (ID: {}) belonging to organization '{}'", board.getName(), board.getId(), organization.getName());
        }
        boardRepository.flush();

        // 2. Detach all users from this organization (users are NOT deleted)
        List<User> members = userRepository.findAllByOrganizationIdOrderByUsernameAsc(organizationId);
        for (User user : members) {
            user.getOrganizations().remove(organization);
            userRepository.save(user);
            log.info("Detached user '{}' from deleted organization '{}'", user.getUsername(), organization.getName());
        }
        userRepository.flush();

        // 3. Delete the organization
        organizationRepository.delete(organization);
        organizationRepository.flush();
        log.info("Successfully deleted organization '{}' (ID: {})", organization.getName(), organizationId);
    }

    private UserSummaryDto toUserSummaryDto(User u) {
        List<Long> orgIds = u.getOrganizations() != null
                ? u.getOrganizations().stream().map(Organization::getId).sorted().toList()
                : List.of();

        List<String> orgNames = u.getOrganizations() != null
                ? u.getOrganizations().stream().map(Organization::getName).sorted().toList()
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
