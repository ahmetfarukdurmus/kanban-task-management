package com.kanban.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kanban.security.jwt.AuthTokenFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Map;

/**
 * Spring Security 6 configuration.
 *
 * <ul>
 *   <li>Stateless session (JWT – no HttpSession)</li>
 *   <li>CSRF disabled (safe for stateless REST APIs)</li>
 *   <li>Public routes: {@code /auth/**}</li>
 *   <li>All other routes require authentication</li>
 * </ul>
 */
@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity          // enables @PreAuthorize / @PostAuthorize
@RequiredArgsConstructor
public class SecurityConfig {

    private final AuthTokenFilter     authTokenFilter;
    private final UserDetailsService  userDetailsService;

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

    // ── Custom 401 entry point ─────────────────────────────────────────────

    @Bean
    public AuthenticationEntryPoint unauthorizedHandler() {
        return (request, response, ex) -> {
            log.warn("Unauthorized request – {}", ex.getMessage());
            response.setStatus(401);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            new ObjectMapper().writeValue(response.getOutputStream(),
                    Map.of("error", "Unauthorized",
                           "message", ex.getMessage()));
        };
    }

    // ── Security filter chain ─────────────────────────────────────────────

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF – stateless REST; tokens make CSRF irrelevant
            .csrf(AbstractHttpConfigurer::disable)

            // Return 401 JSON on unauthenticated requests
            .exceptionHandling(ex -> ex.authenticationEntryPoint(unauthorizedHandler()))

            // Fully stateless – no HttpSession
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Route authorisation
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/auth/**").permitAll()          // public
                    .requestMatchers("/actuator/health").permitAll()  // health probe
                    .anyRequest().authenticated()                     // everything else
            )

            // Register custom JWT filter before Spring's username/password filter
            .addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class)

            // Wire in our DaoAuthenticationProvider
            .authenticationProvider(authenticationProvider());

        return http.build();
    }
}
