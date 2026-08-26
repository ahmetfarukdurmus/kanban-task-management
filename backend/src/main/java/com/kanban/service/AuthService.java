package com.kanban.service;

import com.kanban.dto.auth.AuthResponse;
import com.kanban.dto.auth.LoginRequest;
import com.kanban.dto.auth.RegisterRequest;
import com.kanban.entity.User;
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

/**
 * Business logic for user registration and authentication.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository        userRepository;
    private final PasswordEncoder       passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils              jwtUtils;

    /**
     * Registers a new user.
     *
     * @param request validated register payload
     * @return {@link AuthResponse} with a fresh JWT
     * @throws IllegalArgumentException if username or email is already taken
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username is already taken: " + request.username());
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email is already registered: " + request.email());
        }

        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .build();

        userRepository.save(user);

        String token = jwtUtils.generateToken(user);
        return new AuthResponse(token, user.getId(), user.getUsername(), user.getEmail());
    }

    /**
     * Authenticates an existing user.
     *
     * @param request validated login payload
     * @return {@link AuthResponse} with a fresh JWT
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

        return new AuthResponse(token, user.getId(), user.getUsername(), user.getEmail());
    }
}
