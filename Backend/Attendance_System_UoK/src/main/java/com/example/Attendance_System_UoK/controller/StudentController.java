package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.dto.UserResponse;
import com.example.Attendance_System_UoK.service.StudentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentStudent(Authentication authentication) {
        String username = authentication.getName();
        return ResponseEntity.ok(studentService.getStudentByUsername(username));
    }

    @PutMapping("/courses/{courseId}/archive")
    public ResponseEntity<Void> archiveCourse(@PathVariable String courseId, Authentication authentication) {
        String username = authentication.getName();
        studentService.archiveCourse(username, courseId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/courses/{courseId}/unarchive")
    public ResponseEntity<Void> unarchiveCourse(@PathVariable String courseId, Authentication authentication) {
        String username = authentication.getName();
        studentService.unarchiveCourse(username, courseId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/all")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<org.springframework.data.domain.Page<UserResponse>> getAllStudents(
            org.springframework.data.domain.Pageable pageable) {
        return ResponseEntity.ok(studentService.getAllStudents(pageable));
    }

    @PutMapping("/update/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> updateStudent(@PathVariable String id,
            @RequestBody com.example.Attendance_System_UoK.dto.RegisterRequest studentDetails) {
        return ResponseEntity.ok(studentService.updateStudent(id, studentDetails));
    }

    @GetMapping("/{id}/courses")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<java.util.List<com.example.Attendance_System_UoK.model.Course>> getStudentCourses(
            @PathVariable String id) {
        return ResponseEntity.ok(studentService.getStudentCourses(id));
    }
}
