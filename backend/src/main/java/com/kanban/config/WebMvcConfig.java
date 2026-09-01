package com.kanban.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * Serves uploaded files as static resources under {@code /uploads/**}.
 *
 * <p>Files stored in the upload directory (configured via {@code app.upload.dir},
 * defaulting to the {@code uploads/} folder relative to the working directory)
 * are accessible at {@code /api/uploads/<filename>} without authentication.
 * The SecurityConfig controls whether the {@code /uploads/**} path requires
 * a valid token.</p>
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String absolutePath = Paths.get(uploadDir).toAbsolutePath().normalize().toUri().toString();
        registry
                .addResourceHandler("/uploads/**")
                .addResourceLocations(absolutePath);
    }
}
