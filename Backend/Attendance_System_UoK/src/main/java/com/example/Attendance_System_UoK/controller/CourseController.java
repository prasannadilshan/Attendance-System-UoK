package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.dto.CourseBasicResponse;
import com.example.Attendance_System_UoK.dto.CreateCourseDTO;
import com.example.Attendance_System_UoK.model.Course;
import com.example.Attendance_System_UoK.model.Student;
import com.example.Attendance_System_UoK.model.Teacher;
import com.example.Attendance_System_UoK.repository.StudentRepository;
import com.example.Attendance_System_UoK.service.CourseService;
import com.example.Attendance_System_UoK.repository.TeacherRepository;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;

    public CourseController(CourseService courseService,
            TeacherRepository teacherRepository, StudentRepository studentRepository) {
        this.courseService = courseService;
        this.teacherRepository = teacherRepository;
        this.studentRepository = studentRepository;
    }

    @PostMapping("/create")
    @PreAuthorize("hasRole('TEACHER')")
    public Course createCourse(@Valid @RequestBody CreateCourseDTO dto, Authentication authentication) {
        String username = authentication.getName();
        return courseService.createCourse(dto, username);
    }

    @GetMapping
    public List<CourseBasicResponse> getAllCourses() {
        return courseService.getAllCourses();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public CourseBasicResponse getCourseById(@PathVariable String id) {
        return courseService.getCourseDetails(id);
    }

    // Enroll student (can be done by student or admin or teacher)
    @PostMapping("/{courseId}/enroll")
    @PreAuthorize("hasAnyRole('STUDENT')")
    public Course enrollStudent(
            @PathVariable String courseId,
            @RequestParam(required = false) String key,
            Authentication authentication) {
        String username = authentication.getName();
        Optional<Student> student = studentRepository.findByUsername(username);
        String id = student.get().getId();
        return courseService.enrollStudent(courseId, id, key);
    }

    @DeleteMapping("/{courseId}/unenroll/{studentId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'STUDENT')")
    public void unenrollStudent(@PathVariable String courseId, @PathVariable String studentId,
            Authentication authentication) {
        String username = authentication.getName();

        // Authorization Check
        boolean isTeacher = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TEACHER"));

        if (isTeacher) {
            // Teacher can only remove students from THEIR course
            Course course = courseService.getCourseById(courseId);
            Teacher teacher = teacherRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("Teacher not found"));

            if (course.getTeacherIds() == null || !course.getTeacherIds().contains(teacher.getId())) {
                throw new RuntimeException("You are not the teacher of this course");
            }
            // For teacher, we MUST use the path variable studentId to know WHO to remove
            courseService.unenrollStudent(courseId, studentId);

        } else {
            // Student can only remove THEMSELVES
            // We IGNORE the path variable studentId and strictly use the ID from the token
            Student student = studentRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("Student not found"));

            // Log for debugging
            System.out.println("DEBUG UNENROLL: Authenticated Student: " + username);
            System.out.println("DEBUG UNENROLL: Using correct ID from DB: " + student.getId());

            courseService.unenrollStudent(courseId, student.getId());
        }
    }

    @GetMapping("/teacher")
    @PreAuthorize("hasRole('TEACHER')")
    public List<Course> getMyCourses(Principal principal) {
        // get teacher id by username
        Teacher teacher = teacherRepository.findAll()
                .stream()
                .filter(t -> t.getUsername().equals(principal.getName()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        return courseService.getCoursesByTeacher(teacher.getId());
    }

    @GetMapping("/enrolled")
    @PreAuthorize("hasRole('STUDENT')")
    public List<CourseBasicResponse> getEnrolledCourses(Authentication authentication) {
        String username = authentication.getName();
        Student student = studentRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        return courseService.getEnrolledCourses(student.getId());
    }

    @GetMapping("/{courseId}/students")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public List<com.example.Attendance_System_UoK.dto.StudentBasicInfo> getEnrolledStudents(
            @PathVariable String courseId) {
        return courseService.getEnrolledStudents(courseId);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteCourse(@PathVariable String id) {
        courseService.deleteCourse(id);
    }

    @PostMapping("/admin/create")
    @PreAuthorize("hasRole('ADMIN')")
    public Course createCourseForAdmin(
            @Valid @RequestBody CreateCourseDTO dto,
            @RequestParam String teacherId) {
        return courseService.createCourseForAdmin(dto, teacherId);
    }

    @PutMapping("/{id}/archive")
    @PreAuthorize("hasRole('TEACHER')")
    public void archiveCourse(@PathVariable String id) {
        courseService.toggleArchiveStatus(id, true);
    }

    @PutMapping("/{id}/unarchive")
    @PreAuthorize("hasRole('TEACHER')")
    public void unarchiveCourse(@PathVariable String id) {
        courseService.toggleArchiveStatus(id, false);
    }

    @PutMapping("/update/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public Course updateCourse(@PathVariable String id, @RequestBody CreateCourseDTO dto) {
        return courseService.updateCourse(id, dto);
    }

    @GetMapping("/{id}/export/attendance")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public org.springframework.http.ResponseEntity<org.springframework.core.io.Resource> exportAttendance(
            @PathVariable String id) {
        String filename = "attendance_matrix.xlsx";
        org.springframework.core.io.InputStreamResource file = new org.springframework.core.io.InputStreamResource(
                courseService.generateSessionWiseAttendanceReport(id));

        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.ms-excel"))
                .body(file);
    }

    @GetMapping("/{id}/export/students")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public org.springframework.http.ResponseEntity<org.springframework.core.io.Resource> exportStudents(
            @PathVariable String id) {
        String filename = "enrolled_students.xlsx";
        org.springframework.core.io.InputStreamResource file = new org.springframework.core.io.InputStreamResource(
                courseService.generateEnrolledStudentsReport(id));

        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.ms-excel"))
                .body(file);
    }
}
