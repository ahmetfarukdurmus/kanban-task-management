package com.kanban.controller;

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
 * GET  /api/organizations        – list available organizations for registration / selection (Public)
 * GET  /api/organizations/public – explicitly public list of departments (Public)
 * POST /api/organizations        – create a new organization with optional admin (Super Admin only)
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
     * Super Admin endpoint for creating a new Department / Organization.
     */
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<OrganizationDto> createOrganization(
            @Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationDto created = organizationService.createOrganization(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
