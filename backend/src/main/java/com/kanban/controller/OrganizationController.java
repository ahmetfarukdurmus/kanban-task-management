package com.kanban.controller;

import com.kanban.dto.organization.AssignExistingMembersRequest;
import com.kanban.dto.organization.CreateNewMemberRequest;
import com.kanban.dto.organization.CreateOrganizationRequest;
import com.kanban.dto.organization.OrganizationDto;
import com.kanban.dto.user.UserSummaryDto;
import com.kanban.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Organization and Department Member resources.
 *
 * <pre>
 * GET    /api/organizations                        – list all organizations (Public)
 * GET    /api/organizations/public                 – public organizations list (Public)
 * POST   /api/organizations                        – create new organization (Super Admin)
 * DELETE /api/organizations/{id}                   – delete organization and cascade boards (Super Admin)
 * GET    /api/organizations/{orgId}/members        – list members in organization
 * POST   /api/organizations/{orgId}/members/existing – add existing users to organization (Super Admin)
 * POST   /api/organizations/{orgId}/members/new    – create & add new user to organization (Super Admin)
 * DELETE /api/organizations/{orgId}/members/{userId} – remove user from organization (Super Admin)
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
     * Super Admin endpoint for deleting an organization, cascading boards and detaching members.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteOrganization(@PathVariable Long id) {
        organizationService.deleteOrganization(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns all members of a department.
     */
    @GetMapping("/{orgId}/members")
    public ResponseEntity<List<UserSummaryDto>> getMembers(@PathVariable Long orgId) {
        return ResponseEntity.ok(organizationService.getOrganizationMembers(orgId));
    }

    /**
     * Super Admin endpoint for adding existing users to an organization (ManyToMany).
     */
    @PostMapping({"/{orgId}/members/existing", "/{orgId}/members"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> addExistingMembers(
            @PathVariable Long orgId,
            @Valid @RequestBody AssignExistingMembersRequest request) {
        organizationService.addExistingMembers(orgId, request.userIds());
        return ResponseEntity.noContent().build();
    }

    /**
     * Super Admin endpoint for creating a new user and attaching them to an organization.
     */
    @PostMapping("/{orgId}/members/new")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UserSummaryDto> createNewMember(
            @PathVariable Long orgId,
            @Valid @RequestBody CreateNewMemberRequest request) {
        UserSummaryDto created = organizationService.createNewMember(orgId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Super Admin endpoint for removing a user from an organization.
     */
    @DeleteMapping("/{orgId}/members/{userId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> removeMember(
            @PathVariable Long orgId,
            @PathVariable Long userId) {
        organizationService.removeMemberFromOrganization(orgId, userId);
        return ResponseEntity.noContent().build();
    }
}
