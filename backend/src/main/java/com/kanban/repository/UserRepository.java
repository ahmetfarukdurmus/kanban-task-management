package com.kanban.repository;

import com.kanban.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    /** Total number of registered users. */
    long count();

    /** All users ordered alphabetically by username – used for assignee selection and team modals. */
    List<User> findAllByOrderByUsernameAsc();

    /** All users belonging to the given organization (via ManyToMany join). */
    @Query("SELECT DISTINCT u FROM User u JOIN u.organizations o WHERE o.id = :organizationId ORDER BY u.username ASC")
    List<User> findAllByOrganizationIdOrderByUsernameAsc(@Param("organizationId") Long organizationId);
}
