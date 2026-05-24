package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.service.SystemSettingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    private final SystemSettingService service;

    public SystemController(SystemSettingService service) {
        this.service = service;
    }

    @GetMapping("/timezone")
    public ResponseEntity<Map<String, String>> getTimezone() {
        return ResponseEntity.ok(Map.of("timezone", service.getCurrentTimezoneId()));
    }

    @PostMapping("/timezone")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updateTimezone(@RequestBody Map<String, String> body) {
        String zoneId = body.get("timezone");
        service.updateSystemTimezone(zoneId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/general")
    public ResponseEntity<Map<String, Object>> getGeneralSettings() {
        return ResponseEntity.ok(Map.of(
                "academicYear", service.getAcademicYear(),
                "semester", service.getSemester(),
                "attendanceThreshold", service.getAttendanceThreshold(),
                "sessionDuration", service.getSessionDuration()));
    }

    @PostMapping("/general")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updateGeneralSettings(@RequestBody Map<String, Object> body) {
        if (body.containsKey("academicYear"))
            service.updateAcademicYear((String) body.get("academicYear"));
        if (body.containsKey("semester"))
            service.updateSemester((String) body.get("semester"));
        if (body.containsKey("attendanceThreshold"))
            service.updateAttendanceThreshold(Integer.parseInt(body.get("attendanceThreshold").toString()));
        if (body.containsKey("sessionDuration"))
            service.updateSessionDuration(Integer.parseInt(body.get("sessionDuration").toString()));
        return ResponseEntity.ok().build();
    }
}
