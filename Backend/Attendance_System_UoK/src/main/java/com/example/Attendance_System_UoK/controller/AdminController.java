package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.dto.UserResponse;
import com.example.Attendance_System_UoK.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String id) {
        return ResponseEntity.ok(adminService.getUserById(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        adminService.deleteUser(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/students")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> createStudent(
            @RequestBody com.example.Attendance_System_UoK.dto.RegisterRequest request) {
        adminService.createStudent(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/students/search")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> searchStudents(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String faculty,
            @RequestParam(required = false) String degree) {
        return ResponseEntity.ok(adminService.searchStudents(query, faculty, degree));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<java.util.Map<String, Long>> getDashboardStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    @PostMapping("/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> resetPassword(@RequestBody java.util.Map<String, String> payload) {
        String userId = payload.get("userId");
        String newPassword = payload.get("newPassword");
        adminService.resetPassword(userId, newPassword);
        return ResponseEntity.ok().build();
    }
}
