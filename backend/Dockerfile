# ─────────────────────────────────────────────────────────────────────
# Stage 1: Build
#   - Uses the official Maven + JDK 21 image to compile and package.
#   - pom.xml is copied first so the dependency layer is cached;
#     re-built only when pom.xml changes.
# ─────────────────────────────────────────────────────────────────────
FROM maven:3.9.8-eclipse-temurin-21 AS builder

WORKDIR /app

# ── Dependency cache layer ──────────────────────────────────────────
COPY pom.xml .
RUN mvn dependency:go-offline -B -q

# ── Source & compile ────────────────────────────────────────────────
COPY src ./src
RUN mvn package -DskipTests -B -q


# ─────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
#   - Eclipse Temurin JRE 21 on Alpine: ~180 MB (vs ~600 MB for JDK).
#   - Runs as a non-root user for security.
#   - JVM flags:
#       -XX:+UseContainerSupport       → respect Docker memory limits
#       -XX:MaxRAMPercentage=75.0      → use ≤75% of container RAM
#       -Djava.security.egd=...        → faster SecureRandom on Linux
# ─────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime

WORKDIR /app

# Create a dedicated non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only the fat-JAR from the builder stage
COPY --from=builder /app/target/*.jar app.jar

# Create uploads directory and set permissions for non-root user
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app/uploads /app

USER appuser

EXPOSE 8080

ENTRYPOINT ["java", \
            "-XX:+UseContainerSupport", \
            "-XX:MaxRAMPercentage=75.0", \
            "-Djava.security.egd=file:/dev/./urandom", \
            "-jar", "app.jar"]
