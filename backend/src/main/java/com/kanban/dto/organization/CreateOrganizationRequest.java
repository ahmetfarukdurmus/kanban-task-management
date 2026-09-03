package com.kanban.dto.organization;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload for creating a new Department / Organization with optional Admin and initial Member assignment.
 */
public record CreateOrganizationRequest(
        @NotBlank(message = "Departman adı zorunludur")
        @Size(max = 100, message = "Departman adı en fazla 100 karakter olabilir")
        String name,

        @Size(max = 255, message = "Açıklama en fazla 255 karakter olabilir")
        String description,

        Long adminUserId,

        @Valid
        NewAdminDto newAdmin,

        Long initialUserId,

        @Valid
        NewUserDto newUser
) {
    public record NewAdminDto(
            String username,
            String email,
            String password
    ) {}

    public record NewUserDto(
            String username,
            String email,
            String password
    ) {}
}
