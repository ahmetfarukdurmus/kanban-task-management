package com.kanban.dto.organization;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record AssignExistingMembersRequest(
        @NotEmpty(message = "En az bir kullanıcı seçilmelidir")
        List<Long> userIds
) {}
