package com.example.Attendance_System_UoK.service.impl;

import com.example.Attendance_System_UoK.dto.StudentBasicInfo;
import com.example.Attendance_System_UoK.model.Attendance;
import com.example.Attendance_System_UoK.model.Student;
import com.example.Attendance_System_UoK.repository.AttendanceRepository;
import com.example.Attendance_System_UoK.repository.StudentRepository;
import com.example.Attendance_System_UoK.service.AttendanceService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final StudentRepository studentRepository;
    private final com.example.Attendance_System_UoK.repository.SessionRepository sessionRepository;
    private final com.example.Attendance_System_UoK.repository.CourseRepository courseRepository;
    private final com.example.Attendance_System_UoK.service.SystemSettingService systemSettingService;

    public AttendanceServiceImpl(AttendanceRepository attendanceRepository, StudentRepository studentRepository,
            com.example.Attendance_System_UoK.repository.SessionRepository sessionRepository,
            com.example.Attendance_System_UoK.repository.CourseRepository courseRepository,
            com.example.Attendance_System_UoK.service.SystemSettingService systemSettingService) {
        this.attendanceRepository = attendanceRepository;
        this.studentRepository = studentRepository;
        this.sessionRepository = sessionRepository;
        this.courseRepository = courseRepository;
        this.systemSettingService = systemSettingService;
    }

    @Override
    public List<StudentBasicInfo> getAttendanceBySessionId(String sessionId) {
        List<Attendance> attendances = attendanceRepository.findBySessionId(sessionId);

        return attendances.stream().map(att -> {
            Student student = studentRepository.findById(att.getStudentId()).orElse(null);
            if (student != null) {
                // Check if device owner is different (Fraud Check)
                String deviceMismatchInfo = null;
                if (att.getDeviceStudentId() != null && !att.getDeviceStudentId().equals(att.getStudentId())) {
                    Student owner = studentRepository.findById(att.getDeviceStudentId()).orElse(null);
                    if (owner != null) {
                        deviceMismatchInfo = owner.getStudentId(); // Use Index Number for display
                    }
                }

                return new StudentBasicInfo(student.getId(), student.getFullName(), student.getStudentId(),
                        att.getMarkedAt(), deviceMismatchInfo, att.getStatus(), student.getFaculty(),
                        student.getDegreeProgram());
            }
            return new StudentBasicInfo(att.getStudentId(), "Unknown", "Unknown", att.getMarkedAt(), null,
                    att.getStatus(), null, null);
        }).collect(Collectors.toList());
    }

    @Override
    public List<com.example.Attendance_System_UoK.dto.AttendanceStatusDTO> getStudentAttendanceStatus(
            String studentId) {
        List<Attendance> attendances = attendanceRepository.findByStudentId(studentId);

        return attendances.stream().map(att -> {
            com.example.Attendance_System_UoK.model.Session session = sessionRepository.findById(att.getSessionId())
                    .orElse(null);
            int required = (session != null) ? session.getRequiredCheckIns() : 1;
            int count = (att.getCheckInTimes() != null) ? att.getCheckInTimes().size() : 1;
            boolean completed = count >= required;

            java.time.LocalDateTime nextAllowed = null;
            if (session != null && att.getCheckInTimes() != null && !att.getCheckInTimes().isEmpty()) {
                java.time.LocalDateTime last = att.getCheckInTimes().get(att.getCheckInTimes().size() - 1);
                nextAllowed = last.plusMinutes(session.getCheckInIntervalMinutes());
            }

            return new com.example.Attendance_System_UoK.dto.AttendanceStatusDTO(
                    att.getSessionId(),
                    count,
                    required,
                    att.getMarkedAt(),
                    completed,
                    nextAllowed,
                    att.getCheckInTimes());
        }).collect(Collectors.toList());
    }

    @Override
    public void manualMarkAttendance(String sessionId, String studentId, String note) {
        Attendance attendance = attendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                .orElse(new Attendance());

        if (attendance.getId() == null) {
            attendance.setSessionId(sessionId);
            attendance.setStudentId(studentId);
            com.example.Attendance_System_UoK.model.Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session != null) {
                attendance.setCourseId(session.getCourseId());
            }
            attendance.setCheckInTimes(new java.util.ArrayList<>());
        }

        attendance.setManuallyMarked(true);
        attendance.setManualMarkNote(note);
        attendance.setStatus("PRESENT");
        
        java.time.LocalDateTime now = java.time.LocalDateTime.now(systemSettingService.getSystemTimezone());
        attendance.setMarkedAt(now);

        if (attendance.getCheckInTimes() == null) {
            attendance.setCheckInTimes(new java.util.ArrayList<>());
        }
        
        attendance.getCheckInTimes().add(now);

        attendanceRepository.save(attendance);
    }

    // Deprecate or remove getMarkedSessionIdsForStudent if not needed, or keep for
    // backward compat
    @Override
    public List<String> getMarkedSessionIdsForStudent(String courseId, String studentId) {
        return attendanceRepository.findByStudentId(studentId).stream()
                .map(Attendance::getSessionId)
                .collect(Collectors.toList());
    }

    @Override
    public List<com.example.Attendance_System_UoK.dto.CourseAttendanceReportDTO> getCourseAttendanceReport(
            String courseId) {
        // 1. Get Course to find students
        com.example.Attendance_System_UoK.model.Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));

        List<String> studentIds = course.getStudentIds();
        if (studentIds == null)
            studentIds = new java.util.ArrayList<>();

        // 2. Get All Sessions for Course
        List<com.example.Attendance_System_UoK.model.Session> rawSessions = sessionRepository.findByCourseId(courseId);

        // Filter out DELETED sessions
        List<com.example.Attendance_System_UoK.model.Session> sessions = rawSessions.stream()
                .filter(s -> s.getStatus() != com.example.Attendance_System_UoK.model.SessionStatus.DELETED)
                .collect(Collectors.toList());

        // 3. Pre-fetch all attendance for the course
        List<Attendance> allAttendance = attendanceRepository.findByCourseId(courseId);
        
        // Fallback for legacy records that don't have courseId populated yet
        if (allAttendance.isEmpty() && !sessions.isEmpty()) {
            List<String> sessionIds = sessions.stream().map(com.example.Attendance_System_UoK.model.Session::getId)
                    .collect(Collectors.toList());
            allAttendance = attendanceRepository.findBySessionIdIn(sessionIds);
        }

        // Map: StudentID -> SessionID -> Status
        java.util.Map<String, java.util.Map<String, String>> studentSessionStatus = new java.util.HashMap<>();

        for (Attendance att : allAttendance) {
            studentSessionStatus.computeIfAbsent(att.getStudentId(), k -> new java.util.HashMap<>())
                    .put(att.getSessionId(), att.getStatus());
        }

        // 4. Build Report
        List<Student> students = studentRepository.findAllById(studentIds);

        return students.stream().map(student -> {
            java.util.Map<String, String> statusMap = new java.util.HashMap<>();
            int presentCount = 0;
            int totalSessions = 0; // Only count PAST/EXPIRED sessions for percentage? Or all? Usually expired.

            for (com.example.Attendance_System_UoK.model.Session session : sessions) {
                // Check if session is expired or active?
                // Usually gradebook shows everything.

                String status = studentSessionStatus.getOrDefault(student.getId(), new java.util.HashMap<>())
                        .getOrDefault(session.getId(), "ABSENT");

                // Override if not marked and session is future? No, default ABSENT is fine for
                // now,
                // maybe UI handles "FUTURE" display.
                // Let's refine: If session is SCHEDULED (future), status could be "-".
                if (session.getStatus() == com.example.Attendance_System_UoK.model.SessionStatus.SCHEDULED) {
                    status = "-";
                } else {
                    totalSessions++;
                    if ("PRESENT".equals(status)) {
                        presentCount++;
                    }
                }
                statusMap.put(session.getId(), status);
            }

            double percentage = totalSessions > 0 ? (double) presentCount / totalSessions * 100 : 0;

            return new com.example.Attendance_System_UoK.dto.CourseAttendanceReportDTO(
                    student.getId(),
                    student.getFullName(),
                    student.getStudentId(),
                    statusMap,
                    Math.round(percentage * 10.0) / 10.0 // 1 decimal place
            );
        }).collect(Collectors.toList());
    }
}
