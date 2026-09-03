package com.kanban.dto.organization;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateNewMemberRequest(
        @NotBlank(message = "Kullanıcı adı zorunludur")
        @Size(max = 50, message = "Kullanıcı adı en fazla 50 karakter olabilir")
        String username,

        String email,

        String password,

        String role
) {}
