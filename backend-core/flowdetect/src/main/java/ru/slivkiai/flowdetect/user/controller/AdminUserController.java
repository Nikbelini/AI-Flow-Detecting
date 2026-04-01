package ru.slivkiai.flowdetect.user.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.user.domain.entity.Role;
import ru.slivkiai.flowdetect.user.dto.UserCreateRequest;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.service.AdminUserService;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
    
    private final AdminUserService adminUserService;

    @PostMapping
    public ResponseEntity<UserGetResponse> create(@RequestBody UserCreateRequest dto) {
        return ResponseEntity.status(201).body(adminUserService.createUser(dto));
    }

    @GetMapping
    public ResponseEntity<Page<UserGetResponse>> getAll(@RequestParam Role role,
        @RequestParam(required = false) String search, Pageable pageable) {
            return ResponseEntity.ok(adminUserService.getAllUsers(role, search, pageable));
        }

    @GetMapping("/{id}")
    public ResponseEntity<UserGetResponse> get(@PathVariable long id) {
        return ResponseEntity.ok(adminUserService.getUser(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        adminUserService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/lock")
    public ResponseEntity<Void> lock(@PathVariable long id) {
        adminUserService.lockUser(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/unlock")
    public ResponseEntity<Void> unlock(@PathVariable long id) {
        adminUserService.unlockUser(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/role")
    public ResponseEntity<Void> changeRole(@PathVariable long id, @RequestParam Role role) {
        adminUserService.changeRole(id, role);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable long id, @RequestParam String password) {
        adminUserService.resetPassword(id, password);
        return ResponseEntity.ok().build();
    }
}
