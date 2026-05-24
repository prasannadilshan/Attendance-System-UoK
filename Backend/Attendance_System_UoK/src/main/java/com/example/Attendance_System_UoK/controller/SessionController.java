package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.dto.MarkAttendanceRequest;
import com.example.Attendance_System_UoK.dto.SessionRequest;
import com.example.Attendance_System_UoK.dto.SessionUpdateRequest;
import com.example.Attendance_System_UoK.dto.UserResponse;
import com.example.Attendance_System_UoK.model.Attendance;
import com.example.Attendance_System_UoK.model.Session;
import com.example.Attendance_System_UoK.service.SessionService;
import com.example.Attendance_System_UoK.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionService sessionService;
    private final UserService userService;

    public SessionController(SessionService sessionService, UserService userService) {
        this.sessionService = sessionService;
        this.userService = userService;
    }

    @PostMapping("/create")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<Session>> createSession(@RequestBody SessionRequest request,
            Authentication authentication) {
        // Teacher ID logic - fetch from User service or Auth
        // Assuming username is email/username, get User then ID
        String username = authentication.getName();
        // Since we don't have getTeacherByUsername explicitly returning ID easily
        // without fetching User object
        // We can use userService to get UserResponse then ID?
        // UserService.getUserByUsername returns UserResponse which has ID.
        UserResponse user = userService.getUserByUsername(username);
        // If ADMIN, the request should probably contain the teacher ID or we assume the
        // admin IS the teacher?
        // Admin creating session for a course... the session adheres to the course.
        // The `createSessions` service method likely uses the userId to verify
        // ownership or just logs it.
        // Let's check SessionService.createSessions.
        // For now, allow ADMIN.
        return ResponseEntity.ok(sessionService.createSessions(request, user.getId()));
    }

    @GetMapping("/student")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<Session>> getStudentSessions(Authentication authentication) {
        String username = authentication.getName();
        UserResponse user = userService.getUserByUsername(username);
        // UserResponse has ID
        return ResponseEntity.ok(sessionService.getStudentSessions(user.getId()));
    }

    @GetMapping("/teacher")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<List<Session>> getTeacherSessions(Authentication authentication) {
        String username = authentication.getName();
        UserResponse user = userService.getUserByUsername(username);
        return ResponseEntity.ok(sessionService.getTeacherSessions(user.getId()));
    }

    @GetMapping("/course/{courseId}")
    @PreAuthorize("hasAnyRole('TEACHER','STUDENT', 'ADMIN')")
    public ResponseEntity<List<Session>> getSessionsByCourse(@PathVariable String courseId) {
        return ResponseEntity.ok(sessionService.getSessionsByCourseId(courseId));
    }

    @PostMapping("/mark")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Attendance> markAttendance(@RequestBody MarkAttendanceRequest request,
            Authentication authentication) {
        String username = authentication.getName();
        UserResponse user = userService.getUserByUsername(username);
        return ResponseEntity.ok(sessionService.markAttendance(user.getId(), request));
    }

    @PutMapping("/update/{sessionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Session> updateSession(@PathVariable String sessionId,
            @RequestBody SessionUpdateRequest request) {
        return ResponseEntity.ok(sessionService.updateSession(sessionId, request));
    }

    @DeleteMapping("/{sessionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> deleteSession(@PathVariable String sessionId) {
        sessionService.deleteSession(sessionId);
        return ResponseEntity.ok().build();
    }
}
