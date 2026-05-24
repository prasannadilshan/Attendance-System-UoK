package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.dto.UserResponse;
import com.example.Attendance_System_UoK.service.UserService;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
        String username = authentication.getName();
        return ResponseEntity.ok(userService.getUserByUsername(username));
    }

    @PostMapping("/change-password")
    public ResponseEntity<String> changePassword(Authentication authentication,
            @RequestBody com.example.Attendance_System_UoK.dto.ChangePasswordDTO dto) {
        String username = authentication.getName();
        userService.changePassword(username, dto);
        return ResponseEntity.ok("Password changed successfully");
    }
}