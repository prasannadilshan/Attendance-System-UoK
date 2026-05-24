package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.dto.StudentBasicInfo;
import com.example.Attendance_System_UoK.dto.UserResponse;
import com.example.Attendance_System_UoK.service.AttendanceService;
import com.example.Attendance_System_UoK.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final UserService userService;
    private final com.example.Attendance_System_UoK.service.ExcelExportService excelExportService;
    private final com.example.Attendance_System_UoK.repository.SessionRepository sessionRepository;
    private final com.example.Attendance_System_UoK.service.CourseService courseService;

    public AttendanceController(AttendanceService attendanceService, UserService userService, com.example.Attendance_System_UoK.service.ExcelExportService excelExportService,
                                com.example.Attendance_System_UoK.repository.SessionRepository sessionRepository,
                                com.example.Attendance_System_UoK.service.CourseService courseService) {
        this.attendanceService = attendanceService;
        this.userService = userService;
        this.excelExportService = excelExportService;
        this.sessionRepository = sessionRepository;
        this.courseService = courseService;
    }

    @GetMapping("/session/{sessionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<StudentBasicInfo>> getSessionAttendance(@PathVariable String sessionId) {
        return ResponseEntity.ok(attendanceService.getAttendanceBySessionId(sessionId));
    }

    @GetMapping("/student/marked")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<String>> getMyMarkedSessions(Authentication authentication) {
        String username = authentication.getName();
        UserResponse user = userService.getUserByUsername(username);
        return ResponseEntity.ok(attendanceService.getMarkedSessionIdsForStudent(null, user.getId()));
    }

    @GetMapping("/student/status")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<com.example.Attendance_System_UoK.dto.AttendanceStatusDTO>> getMyAttendanceStatus(
            Authentication authentication) {
        String username = authentication.getName();
        UserResponse user = userService.getUserByUsername(username);
        return ResponseEntity.ok(attendanceService.getStudentAttendanceStatus(user.getId()));
    }

    @PostMapping("/manual-mark")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<String> manualMark(
            @RequestBody com.example.Attendance_System_UoK.dto.ManualMarkRequest request) {
        attendanceService.manualMarkAttendance(request.getSessionId(), request.getStudentId(), request.getNote());
        return ResponseEntity.ok("Attendance manually marked successfully.");
    }

    @GetMapping("/course/{courseId}/report")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<com.example.Attendance_System_UoK.dto.CourseAttendanceReportDTO>> getCourseAttendanceReport(
            @PathVariable String courseId) {
        return ResponseEntity.ok(attendanceService.getCourseAttendanceReport(courseId));
    }

    @GetMapping("/session/{sessionId}/export")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<org.springframework.core.io.Resource> exportSessionAttendance(@PathVariable String sessionId) {
        com.example.Attendance_System_UoK.model.Session session = sessionRepository.findById(sessionId).orElseThrow();
        List<StudentBasicInfo> enrolledStudents = courseService.getEnrolledStudents(session.getCourseId());
        List<StudentBasicInfo> markedAttendances = attendanceService.getAttendanceBySessionId(sessionId);

        for (StudentBasicInfo student : enrolledStudents) {
            StudentBasicInfo attendance = markedAttendances.stream()
                .filter(a -> (a.getId() != null && a.getId().equals(student.getId())) || 
                             (a.getId() != null && a.getId().equals(student.getStudentId())) ||
                             (a.getStudentId() != null && a.getStudentId().equals(student.getStudentId())))
                .findFirst().orElse(null);
            
            if (attendance != null) {
                student.setStatus(attendance.getStatus());
                student.setMarkedAt(attendance.getMarkedAt());
                student.setDeviceMismatchInfo(attendance.getDeviceMismatchInfo());
            } else {
                student.setStatus("ABSENT");
            }
        }

        java.io.ByteArrayInputStream stream = excelExportService.exportAttendanceToExcel(session.getTitle(), enrolledStudents);
        org.springframework.core.io.InputStreamResource file = new org.springframework.core.io.InputStreamResource(stream);
        
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=session_attendance.xlsx")
                .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.ms-excel"))
                .body(file);
    }
}
