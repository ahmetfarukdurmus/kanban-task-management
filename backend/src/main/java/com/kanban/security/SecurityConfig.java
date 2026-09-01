package com.kanban.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kanban.security.jwt.AuthTokenFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.Customizer;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Map;

/**
 * Spring Security 6 configuration.
 *
 * <h3>RBAC summary</h3>
 * <pre>
 * Public (no token):
 *   POST /auth/**
 *   GET  /actuator/health
 *
 * ROLE_ADMIN only:
 *   POST   /boards/{id}/columns                          – add a column
 *   POST   /boards/{id}/columns/{id}/tasks               – create a task
 *   DELETE /boards/{id}/columns/{id}/tasks/{id}          – delete a task
 *
 * ROLE_USER + ROLE_ADMIN (any authenticated user):
 *   PATCH  /tasks/{id}/move                              – DnD move/reorder
 *   GET    /tasks/{id}/comments                          – list comments
 *   POST   /tasks/{id}/comments                          – add comment
 *   GET    /tasks/{id}/attachments                       – list attachments
 *   POST   /tasks/{id}/attachments                       – upload attachment
 *   GET    /users                                        – assignee list
 *   … all other authenticated routes
 * </pre>
 */
@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity          // enables @PreAuthorize / @PostAuthorize
@RequiredArgsConstructor
public class SecurityConfig {

    private final AuthTokenFilter    authTokenFilter;
    private final UserDetailsService userDetailsService;

    // ── Password encoder ─────────────────────────────────────────────────

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ── DaoAuthenticationProvider ─────────────────────────────────────────

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    // ── AuthenticationManager ─────────────────────────────────────────────

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    // ── 401 entry point ───────────────────────────────────────────────────

    @Bean
    public AuthenticationEntryPoint unauthorizedHandler() {
        return (request, response, ex) -> {
            log.warn("Unauthorized request – {}", ex.getMessage());
            response.setStatus(401);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            new ObjectMapper().writeValue(response.getOutputStream(),
                    Map.of("title", "Unauthorized", "status", 401,
                           "detail", ex.getMessage()));
        };
    }

    // ── 403 access-denied handler ─────────────────────────────────────────

    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, ex) -> {
            log.warn("Access denied – {}", ex.getMessage());
            response.setStatus(403);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            new ObjectMapper().writeValue(response.getOutputStream(),
                    Map.of("title", "Forbidden", "status", 403,
                           "detail", "ROLE_ADMIN is required for this operation."));
        };
    }

    // ── Security filter chain ─────────────────────────────────────────────

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Enable CORS – delegates to CorsConfig.corsConfigurationSource() bean
            .cors(Customizer.withDefaults())

            // Disable CSRF – stateless REST; tokens make CSRF irrelevant
            .csrf(AbstractHttpConfigurer::disable)

            // 401 / 403 JSON responses
            .exceptionHandling(ex -> ex
                    .authenticationEntryPoint(unauthorizedHandler())
                    .accessDeniedHandler(accessDeniedHandler()))

            // Fully stateless – no HttpSession
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // ── Route authorisation ───────────────────────────────────────
            .authorizeHttpRequests(auth -> auth

                    // Public endpoints
                    .requestMatchers("/auth/**").permitAll()
                    .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()

                    // Static file serving for uploaded attachments
                    .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                    .requestMatchers(HttpMethod.GET, "/tasks/*/attachments/*/download").permitAll()

                    // ── ADMIN-only write operations ───────────────────────
                    // Add a new column to a board
                    .requestMatchers(HttpMethod.POST,
                            "/boards/*/columns").hasRole("ADMIN")

                    // Create a task within a column
                    .requestMatchers(HttpMethod.POST,
                            "/boards/*/columns/*/tasks").hasRole("ADMIN")

                    // Delete a task
                    .requestMatchers(HttpMethod.DELETE,
                            "/boards/*/columns/*/tasks/*").hasRole("ADMIN")

                    // ── Any authenticated user ────────────────────────────
                    // DnD move/reorder – open to both roles
                    .requestMatchers(HttpMethod.PATCH,
                            "/tasks/*/move").authenticated()

                    // Comments & attachments
                    .requestMatchers("/tasks/*/comments").authenticated()
                    .requestMatchers("/tasks/*/attachments").authenticated()

                    // User list for assignee selection
                    .requestMatchers(HttpMethod.GET, "/users").authenticated()

                    // Everything else requires authentication
                    .anyRequest().authenticated()
            )

            // Register custom JWT filter before Spring's username/password filter
            .addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class)

            // Wire in our DaoAuthenticationProvider
            .authenticationProvider(authenticationProvider());

        return http.build();
    }
}
