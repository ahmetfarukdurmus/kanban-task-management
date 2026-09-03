package com.kanban.controller;

import com.kanban.dto.organization.AssignMembersRequest;
import com.kanban.dto.organization.CreateOrganizationRequest;
import com.kanban.dto.organization.OrganizationDto;
import com.kanban.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Organization resources.
 *
 * <pre>
 * GET  /api/organizations              – list available organizations for registration / selection (Public)
 * GET  /api/organizations/public       – explicitly public list of departments (Public)
 * POST /api/organizations              – create a new organization with optional admin and members (Super Admin only)
 * POST /api/organizations/{id}/members – assign users to an existing organization (Super Admin only)
 * </pre>
 */
@RestController
@RequestMapping("/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService organizationService;

    /**
     * Public endpoint returning all active organizations for registration dropdowns.
     */
    @GetMapping({"", "/public"})
    public ResponseEntity<List<OrganizationDto>> listOrganizations() {
        return ResponseEntity.ok(organizationService.getAllOrganizations());
    }

    /**
     * Super Admin endpoint for creating a new Department / Organization with optional Admin and Members.
     */
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<OrganizationDto> createOrganization(
            @Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationDto created = organizationService.createOrganization(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Super Admin endpoint for bulk assigning users to an existing department.
     */
    @PostMapping("/{id}/members")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> assignMembers(
            @PathVariable Long id,
            @Valid @RequestBody AssignMembersRequest request) {
        organizationService.assignMembersToOrganization(id, request.userIds());
        return ResponseEntity.noContent().build();
    }
}
