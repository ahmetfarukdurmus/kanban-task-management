# ─────────────────────────────────────────────────────────────────────
# Stage 1: Build
#   - Installs dependencies via `npm ci` (clean, reproducible install).
#   - Runs `npm run build` → Vite outputs hashed assets to /app/dist.
#   - node_modules and source files are NOT copied to the final image.
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# ── Dependency cache layer ──────────────────────────────────────────
COPY package.json package-lock.json* ./
RUN npm ci --silent

# ── Build ───────────────────────────────────────────────────────────
COPY . .
RUN npm run build


# ─────────────────────────────────────────────────────────────────────
# Stage 2: Serve
#   - nginx:stable-alpine: ~25 MB final image.
#   - Only the compiled dist/ and custom nginx.conf are copied.
#   - No Node.js, no source code, no dev dependencies in production.
# ─────────────────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS runtime

# Replace the default Nginx config with our custom one
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the Vite production bundle
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx runs in the foreground (daemon off is set in the base image)
CMD ["nginx", "-g", "daemon off;"]
