package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.dto.UserResponse;
import com.example.Attendance_System_UoK.model.Teacher;
import com.example.Attendance_System_UoK.service.TeacherService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import java.util.List;
import com.example.Attendance_System_UoK.model.Course;


@RestController
@RequestMapping("/api/teachers")
public class TeacherController {

    private final TeacherService teacherService;
    private final com.example.Attendance_System_UoK.service.AttendanceService attendanceService;
    private final com.example.Attendance_System_UoK.service.ExcelExportService excelExportService;
    private final com.example.Attendance_System_UoK.repository.SessionRepository sessionRepository;

    public TeacherController(TeacherService teacherService,
            com.example.Attendance_System_UoK.service.AttendanceService attendanceService,
            com.example.Attendance_System_UoK.service.ExcelExportService excelExportService,
            com.example.Attendance_System_UoK.repository.SessionRepository sessionRepository) {
        this.teacherService = teacherService;
        this.attendanceService = attendanceService;
        this.excelExportService = excelExportService;
        this.sessionRepository = sessionRepository;
    }

    // ADMIN only
    @PostMapping("/add")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> addTeacher(@RequestBody Teacher teacher) {
        return ResponseEntity.ok(teacherService.addTeacher(teacher));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<UserResponse>> getAllTeachers(@PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(teacherService.getAllTeachers(pageable));
    }

    @PutMapping("/update/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> updateTeacher(@PathVariable String id,
            @RequestBody com.example.Attendance_System_UoK.dto.RegisterRequest teacherDetails) {
        return ResponseEntity.ok(teacherService.updateTeacher(id, teacherDetails));
    }

    @GetMapping("/{id}/courses")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Course>> getTeacherCourses(@PathVariable String id) {
        return ResponseEntity.ok(teacherService.getTeacherCourses(id));
    }

    // Export Gradebook
    @GetMapping("/courses/{courseId}/gradebook/export")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<org.springframework.core.io.InputStreamResource> exportGradebook(
            @PathVariable String courseId) {
        // 1. Get Sessions (filtered)
        List<com.example.Attendance_System_UoK.model.Session> sessions = sessionRepository.findByCourseId(courseId);
        sessions.removeIf(s -> s.getStatus() == com.example.Attendance_System_UoK.model.SessionStatus.DELETED);

        // 2. Get Report Data
        List<com.example.Attendance_System_UoK.dto.CourseAttendanceReportDTO> reportData = attendanceService
                .getCourseAttendanceReport(courseId);

        // 3. Generate Excel
        java.io.ByteArrayInputStream in = excelExportService.generateSessionWiseAttendanceReport("Gradebook",
                reportData, sessions);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=gradebook-" + courseId + ".xlsx");

        return ResponseEntity
                .ok()
                .headers(headers)
                .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.ms-excel"))
                .body(new org.springframework.core.io.InputStreamResource(in));
    }
}
