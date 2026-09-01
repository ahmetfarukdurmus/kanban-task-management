package com.kanban.repository;

import com.kanban.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findByName(String name);
    List<Organization> findAllByOrderByNameAsc();
}
