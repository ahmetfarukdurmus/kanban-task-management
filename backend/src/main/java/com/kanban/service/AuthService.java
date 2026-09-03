package com.kanban.service;

import com.kanban.dto.auth.AuthResponse;
import com.kanban.dto.auth.LoginRequest;
import com.kanban.dto.auth.RegisterRequest;
import com.kanban.entity.Organization;
import com.kanban.entity.Role;
import com.kanban.entity.User;
import com.kanban.repository.OrganizationRepository;
import com.kanban.repository.UserRepository;
import com.kanban.security.jwt.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

/**
 * Business logic for user registration and authentication.
 *
 * <p>All self-registered users are assigned Role.ROLE_USER (Team Member) within their chosen Department.</p>
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository         userRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder        passwordEncoder;
    private final AuthenticationManager  authenticationManager;
    private final JwtUtils               jwtUtils;

    /**
     * Registers a new Team Member (ROLE_USER) in the selected Department.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username is already taken: " + request.username());
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email is already registered: " + request.email());
        }

        // Default role is ROLE_USER for all registered team members
        Role assignedRole = Role.ROLE_USER;
        if ("ROLE_ADMIN".equalsIgnoreCase(request.role()) || "ADMIN".equalsIgnoreCase(request.role())) {
            assignedRole = Role.ROLE_ADMIN;
        }

        // Resolve Organization if requested
        Organization organization = null;
        if (request.organizationId() != null) {
            organization = organizationRepository.findById(request.organizationId())
                    .orElse(null);
        }

        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(assignedRole)
                .organizations(new HashSet<>())
                .build();

        if (organization != null) {
            user.getOrganizations().add(organization);
        }

        userRepository.save(user);

        String token = jwtUtils.generateToken(user);
        return new AuthResponse(
                token,
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.getPrimaryOrganizationId(),
                user.getPrimaryOrganizationName());
    }

    /**
     * Authenticates an existing user.
     */
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.username(),
                        request.password()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = (User) authentication.getPrincipal();
        String token = jwtUtils.generateToken(user);

        return new AuthResponse(
                token,
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.getPrimaryOrganizationId(),
                user.getPrimaryOrganizationName());
    }
}
