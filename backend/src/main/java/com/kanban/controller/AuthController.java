package com.kanban.controller;

import com.kanban.dto.auth.AuthResponse;
import com.kanban.dto.auth.LoginRequest;
import com.kanban.dto.auth.RegisterRequest;
import com.kanban.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Public REST controller for authentication.
 *
 * <pre>
 * POST /api/auth/register  – create a new account, returns JWT
 * POST /api/auth/login     – authenticate, returns JWT
 * </pre>
 *
 * Both endpoints are whitelisted in {@link com.kanban.security.SecurityConfig}
 * and do not require a Bearer token.
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Register a new user.
     *
     * @param request validated register payload
     * @return 201 Created + {@link AuthResponse}
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Authenticate an existing user.
     *
     * @param request validated login payload
     * @return 200 OK + {@link AuthResponse}
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }
}
