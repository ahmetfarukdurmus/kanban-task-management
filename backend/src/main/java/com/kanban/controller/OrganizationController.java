package com.kanban.controller;

import com.kanban.dto.organization.OrganizationDto;
import com.kanban.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for Organization resources.
 *
 * <pre>
 * GET /api/organizations – list available organizations for registration / selection
 * </pre>
 */
@RestController
@RequestMapping("/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationRepository organizationRepository;

    @GetMapping
    public ResponseEntity<List<OrganizationDto>> listOrganizations() {
        List<OrganizationDto> orgs = organizationRepository.findAllByOrderByNameAsc()
                .stream()
                .map(o -> new OrganizationDto(o.getId(), o.getName(), o.getDescription()))
                .toList();
        return ResponseEntity.ok(orgs);
    }
}
