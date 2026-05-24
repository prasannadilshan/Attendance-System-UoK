package com.example.Attendance_System_UoK.controller;

import com.example.Attendance_System_UoK.service.OtpService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/otp")
public class OtpController {

    @Autowired
    private OtpService otpService;

    @Autowired
    private com.example.Attendance_System_UoK.service.UserService userService;

    // Allowed domains: outlook.com, hotmail.com, live.com, kln.ac.lk, stu.kln.ac.lk
    private static final Pattern MICROSOFT_DOMAIN_PATTERN = Pattern.compile(
            "^[A-Za-z0-9._%+-]+@(outlook\\.com|hotmail\\.com|live\\.com|kln\\.ac\\.lk|stu\\.kln\\.ac\\.lk)$",
            Pattern.CASE_INSENSITIVE);

    @PostMapping("/send")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        boolean isForgotPassword = request.containsKey("isForgotPassword")
                && Boolean.parseBoolean(request.get("isForgotPassword"));

        if (email == null || !MICROSOFT_DOMAIN_PATTERN.matcher(email).matches()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid email domain. Only University emails are allowed."));
        }

        // Check if user exists for Forgot Password flow
        if (isForgotPassword) {
            if (userService.findUserByEmail(email).isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "No user found with this email address."));
            }
        }

        try {
            otpService.generateAndSendOtp(email);
            return ResponseEntity.ok().body(Map.of("message", "OTP sent successfully"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to send OTP"));
        }
    }
}
