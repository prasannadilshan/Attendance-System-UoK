package com.example.Attendance_System_UoK.service.impl;

import com.example.Attendance_System_UoK.dto.CourseAttendanceReportDTO;
import com.example.Attendance_System_UoK.dto.StudentBasicInfo;
import com.example.Attendance_System_UoK.model.Session;
import com.example.Attendance_System_UoK.service.ExcelExportService;
import com.example.Attendance_System_UoK.service.SystemSettingService;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

@Service
public class ExcelExportServiceImpl implements ExcelExportService {
    
    private final SystemSettingService systemSettingService;

    public ExcelExportServiceImpl(SystemSettingService systemSettingService) {
        this.systemSettingService = systemSettingService;
    }

    @Override
    public ByteArrayInputStream exportAttendanceToExcel(String sessionTitle, List<StudentBasicInfo> students) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Attendance");

            Row headerRow = sheet.createRow(0);
            String tz = systemSettingService.getCurrentTimezoneId();
            String[] columns = { "Full Name", "Student ID", "Status", "Check-in Time (" + tz + ")", "Notes" };

            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);

            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (StudentBasicInfo student : students) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(student.getFullName());
                row.createCell(1).setCellValue(student.getStudentId() != null ? student.getStudentId() : "N/A");
                
                String status = "ABSENT";
                if ("PRESENT".equals(student.getStatus())) {
                    status = "PRESENT";
                } else if ("FRAUD".equals(student.getStatus())) {
                    status = "FRAUD (Device Mismatch)";
                }
                row.createCell(2).setCellValue(status);

                String checkInTime = "-";
                if (student.getMarkedAt() != null) {
                    java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss");
                    checkInTime = student.getMarkedAt().format(formatter);
                }
                row.createCell(3).setCellValue(checkInTime);
                
                String notes = "";
                if (student.getDeviceMismatchInfo() != null) {
                    notes = "Device Owner: " + student.getDeviceMismatchInfo();
                }
                row.createCell(4).setCellValue(notes);
            }

            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate Excel file: " + e.getMessage());
        }
    }

    @Override
    public ByteArrayInputStream generateEnrolledStudentsReport(String courseName, List<StudentBasicInfo> students) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Enrolled Students");

            // Header
            Row headerRow = sheet.createRow(0);
            String[] columns = { "Student ID", "Full Name", "Faculty", "Degree Program" };

            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);

            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data
            int rowIdx = 1;
            for (StudentBasicInfo student : students) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(student.getStudentId() != null ? student.getStudentId() : "N/A");
                row.createCell(1).setCellValue(student.getFullName());
                row.createCell(2).setCellValue(student.getFaculty() != null ? student.getFaculty() : "");
                row.createCell(3).setCellValue(student.getDegreeProgram() != null ? student.getDegreeProgram() : "");
            }

            // Auto-size columns
            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate Excel file: " + e.getMessage());
        }
    }

    @Override
    public ByteArrayInputStream generateSessionWiseAttendanceReport(String courseName,
            List<CourseAttendanceReportDTO> reportData,
            List<Session> sessions) {

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Attendance Matrix");

            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // 1. Create Header Row
            Row headerRow = sheet.createRow(0);

            // Fixed Columns
            Cell cell0 = headerRow.createCell(0);
            cell0.setCellValue("Student ID");
            cell0.setCellStyle(headerStyle);

            Cell cell1 = headerRow.createCell(1);
            cell1.setCellValue("Full Name");
            cell1.setCellStyle(headerStyle);

            Cell cell2 = headerRow.createCell(2);
            cell2.setCellValue("Overall %");
            cell2.setCellStyle(headerStyle);

            // Dynamic Session Columns
            int colIdx = 3;
            // Sort sessions by date
            sessions.sort((a, b) -> a.getStartTime().compareTo(b.getStartTime()));
            String tz = systemSettingService.getCurrentTimezoneId();

            for (Session session : sessions) {
                Cell cell = headerRow.createCell(colIdx++);
                // Format: Title (Date)
                String dateStr = session.getStartTime().toLocalDate().toString();
                cell.setCellValue(session.getTitle() + " (" + dateStr + " " + tz + ")");
                cell.setCellStyle(headerStyle);
            }

            // 2. Data Rows
            int rowIdx = 1;
            for (CourseAttendanceReportDTO studentReport : reportData) {
                Row row = sheet.createRow(rowIdx++);

                row.createCell(0).setCellValue(studentReport.getIndexNumber());
                row.createCell(1).setCellValue(studentReport.getFullName());

                Cell pctCell = row.createCell(2);
                pctCell.setCellValue(studentReport.getOverallPercentage() + "%");

                // Color code low attendance check if needed

                colIdx = 3;
                for (Session session : sessions) {
                    String status = studentReport.getSessionStatusMap().getOrDefault(session.getId(), "ABSENT");
                    Cell cell = row.createCell(colIdx++);
                    cell.setCellValue(status);

                    // Simple styling
                    if ("PRESENT".equals(status)) {
                        CellStyle presentStyle = workbook.createCellStyle();
                        Font pFont = workbook.createFont();
                        pFont.setColor(IndexedColors.GREEN.getIndex());
                        presentStyle.setFont(pFont);
                        cell.setCellStyle(presentStyle);
                    } else if ("ABSENT".equals(status)) {
                        CellStyle absentStyle = workbook.createCellStyle();
                        Font aFont = workbook.createFont();
                        aFont.setColor(IndexedColors.RED.getIndex());
                        absentStyle.setFont(aFont);
                        cell.setCellStyle(absentStyle);
                    }
                }
            }

            // Auto-size columns
            for (int i = 0; i < colIdx; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate Excel file: " + e.getMessage());
        }
    }
}
