package ru.slivkiai.flowdetect.user.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.domain.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findById(long id);

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Page<User> findByEmailContainingIgnoreCase(String email, Pageable pageable);

    @Query("""
            SELECT u FROM User u
            WHERE u.role = :role
            AND (
                LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))
                OR
                LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%'))
            )
            """)
    Page<User> searchByRoleAndEmailOrFullName(Role role, String search, Pageable pageable);

    Page<User> findByRoleAndFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(
            Role role, String fullName, String email, Pageable pageable);

    Page<User> findByRole(Role role, Pageable pageable);

}
