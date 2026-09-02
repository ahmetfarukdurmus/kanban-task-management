package com.kanban.security.jwt;

import com.kanban.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Utility class for JWT creation, parsing and validation.
 *
 * <p>Uses the jjwt 0.12.x fluent API with HMAC-SHA256.</p>
 */
@Slf4j
@Component
public class JwtUtils {

    /** Secret key string. Injected from application.yml / env. */
    @Value("${app.jwt.secret}")
    private String jwtSecret;

    /** Token validity period in milliseconds (default 24 h). */
    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    // ── Key helper ───────────────────────────────────────────────────────

    private SecretKey signingKey() {
        byte[] keyBytes;
        try {
            // Attempt Base64URL / Base64 decoding first
            keyBytes = Decoders.BASE64URL.decode(jwtSecret);
            if (keyBytes.length < 32) {
                // If decoded bytes are less than 256 bits, fallback to UTF-8 bytes
                keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            // Fallback to UTF-8 raw bytes if string is not valid Base64
            keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    // ── Token generation ─────────────────────────────────────────────────

    /**
     * Creates a signed JWT for the given user.
     *
     * @param user the authenticated user
     * @return compact JWT string
     */
    public String generateToken(User user) {
        Date now    = new Date();
        Date expiry = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .subject(user.getUsername())
                .claim("userId", user.getId())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey())
                .compact();
    }

    // ── Token parsing ─────────────────────────────────────────────────────

    /**
     * Extracts the username (subject) from a valid token.
     *
     * @param token raw JWT string (without "Bearer " prefix)
     * @return username stored as subject
     */
    public String getUsernameFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    // ── Token validation ──────────────────────────────────────────────────

    /**
     * Validates a JWT string.
     *
     * @param token raw JWT string
     * @return {@code true} if the token is valid and not expired
     */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (MalformedJwtException e) {
            log.warn("JWT: malformed token");
        } catch (ExpiredJwtException e) {
            log.warn("JWT: token expired");
        } catch (UnsupportedJwtException e) {
            log.warn("JWT: unsupported token");
        } catch (IllegalArgumentException e) {
            log.warn("JWT: empty/null token");
        } catch (io.jsonwebtoken.security.SecurityException e) {
            log.warn("JWT: invalid signature");
        }
        return false;
    }

    // ── Internal ──────────────────────────────────────────────────────────

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
