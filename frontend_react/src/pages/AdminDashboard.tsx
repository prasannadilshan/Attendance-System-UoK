import React, { useState, useEffect } from 'react';
import { Container, Button, Form, Alert, Card, Tabs, Tab, Table, Badge, Row, Col, Spinner, InputGroup, Pagination, Modal, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

import DashboardStats from './DashboardStats';

const AdminDashboard: React.FC = () => {
    const [currentTerm, setCurrentTerm] = useState('');

    useEffect(() => {
        api.get('/api/system/general').then(res => {
            if (res.data.academicYear && res.data.semester) {
                setCurrentTerm(`${res.data.academicYear} - ${res.data.semester}`);
            }
        }).catch(err => console.error("Failed to fetch system settings", err));
    }, []);

    return (
        <Container className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2>Admin Dashboard</h2>
                    {currentTerm && <Badge bg="info" className="text-dark mt-2">{currentTerm}</Badge>}
                </div>
                <Button variant="outline-primary" onClick={() => window.location.reload()}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</Button>
            </div>
            
            <Tabs defaultActiveKey="overview" className="mb-4 shadow-sm p-3 bg-white rounded">
                <Tab eventKey="overview" title={<span><i className="bi bi-speedometer2 me-2"></i>Overview</span>}>
                    <DashboardStats />
                </Tab>
                <Tab eventKey="teachers" title={<span><i className="bi bi-person-video3 me-2"></i>Manage Teachers</span>}>
                    <TeacherManager />
                </Tab>
                <Tab eventKey="courses" title={<span><i className="bi bi-book me-2"></i>Manage Courses</span>}>
                    <CourseManager />
                </Tab>
                <Tab eventKey="students" title={<span><i className="bi bi-people me-2"></i>Manage Students</span>}>
                    <StudentManager />
                </Tab>
                <Tab eventKey="settings" title={<span><i className="bi bi-gear me-2"></i>System Settings</span>}>
                    <Row>
                        <Col md={6}>
                            <Card className="p-4 shadow-sm mb-4">
                                <h4 className="mb-3">General Settings</h4>
                                <GeneralSettings />
                            </Card>
                        </Col>
                        <Col md={6}>
                            <Card className="p-4 shadow-sm">
                                <h4 className="mb-3">Timezone Settings</h4>
                                <TimezoneSettings />
                            </Card>
                        </Col>
                    </Row>
                </Tab>
            </Tabs>
        </Container>
    );
};

// Global Constants
const faculties = ["Science", "FCMS", "Arts", "FCT"];

const facultyDepartments: { [key: string]: string[] } = {
    "Science": [
        "Department of Chemistry",
        "Department of Industrial Management",
        "Department of Mathematics",
        "Department of Microbiology",
        "Department of Physics and Electronics",
        "Department of Plant and Molecular Biology",
        "Department of Statistics & Computer Science"
    ],
    "FCMS": ["Department of Commerce", "Department of Finance", "Department of Marketing"],
    "Arts": ["Department of Economics", "Department of English", "Department of History"],
    "FCT": ["Department of ICT", "Department of Engineering Technology"]
};

const positions = [
    "Lecturer",
    "Senior Lecturer",
    "Assistant Professor",
    "Professor",
    "Head of Department",
    "Dean",
    "Instructor",
    "Demonstrator",
    "Visiting Lecturer"
];

interface Teacher {
    id: string;
    teacherId: string;
    fullName: string;
    email: string;
    position: string;
    department: string;
    faculty: string;
    username: string; // Needed for some logic
}

interface Course {
    id: string;
    name: string;
    code: string;
    enrollmentKey?: string;
    teacherName?: string;
}

const TeacherDetailsModal = ({ show, onHide, teacher, refreshTeachers }: { show: boolean, onHide: () => void, teacher: Teacher | null, refreshTeachers: () => void }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [msg, setMsg] = useState({ type: '', content: '' });
    const navigate = useNavigate();

    // Edit State
    const [editData, setEditData] = useState<Partial<Teacher>>({});
    
    // Password State
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        if (teacher && show) {
            setEditData({
                fullName: teacher.fullName,
                email: teacher.email,
                position: teacher.position,
                department: teacher.department,
                faculty: teacher.faculty
            });
            setMsg({ type: '', content: '' });
            setNewPassword('');
            fetchCourses();
        }
    }, [teacher, show]);

    const fetchCourses = async () => {
        if (!teacher) return;
        setLoadingCourses(true);
        try {
            const res = await api.get(`/api/teachers/${teacher.id}/courses`);
            setCourses(res.data);
        } catch (err) {
            console.error("Failed to fetch courses", err);
        } finally {
            setLoadingCourses(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacher) return;
        try {
            await api.put(`/api/teachers/update/${teacher.id}`, editData);
            setMsg({ type: 'success', content: 'Teacher updated successfully' });
            refreshTeachers();
        } catch (err: any) {
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Update failed' });
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacher) return;
        try {
            await api.post('/api/admin/reset-password', { userId: teacher.id, newPassword });
            setMsg({ type: 'success', content: 'Password updated successfully' });
            setNewPassword('');
        } catch (err: any) {
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Update failed' });
        }
    };

    const handleDefaultReset = async () => {
        if (!teacher) return;
        if (!window.confirm(`Are you sure you want to reset password to default? Default is the Teacher ID: ${teacher.teacherId}`)) return;
        try {
            // Default password is the teacher ID
            await api.post('/api/admin/reset-password', { userId: teacher.id, newPassword: teacher.teacherId });
            setMsg({ type: 'success', content: `Password reset to default: ${teacher.teacherId}` });
        } catch (err: any) {
             setMsg({ type: 'danger', content: err.response?.data?.message || 'Reset failed' });
        }
    };

    if (!teacher) return null;

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Teacher Details: {teacher.fullName}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
                <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'details')} className="mb-3">
                    <Tab eventKey="details" title="Details">
                        <Form onSubmit={handleUpdate}>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Full Name</Form.Label>
                                        <Form.Control type="text" value={editData.fullName || ''} onChange={e => setEditData({...editData, fullName: e.target.value})} required />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Email</Form.Label>
                                        <Form.Control type="email" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} required />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Faculty</Form.Label>
                                        <Form.Select 
                                            value={editData.faculty || ''} 
                                            onChange={e => {
                                                const newFaculty = e.target.value;
                                                setEditData(prev => ({
                                                    ...prev, 
                                                    faculty: newFaculty,
                                                    department: '' // Reset department if faculty changes
                                                }));
                                            }}
                                        >
                                            {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Department</Form.Label>
                                        <Form.Select 
                                            value={editData.department || ''} 
                                            onChange={e => setEditData({...editData, department: e.target.value})}
                                            disabled={!editData.faculty}
                                        >
                                            <option value="">Select Department</option>
                                            {editData.faculty && facultyDepartments[editData.faculty]?.map(dept => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                             <Form.Group className="mb-3">
                                <Form.Label>Position</Form.Label>
                                <Form.Select 
                                    value={editData.position || ''} 
                                    onChange={e => setEditData({...editData, position: e.target.value})}
                                >
                                    <option value="">Select Position</option>
                                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                                </Form.Select>
                            </Form.Group>
                            <Button variant="primary" type="submit"><i className="bi bi-save me-1"></i>Update Details</Button>
                        </Form>
                    </Tab>
                    <Tab eventKey="password" title="Security">
                        <Form onSubmit={handleUpdatePassword}>
                            <Form.Group className="mb-3">
                                <Form.Label>New Password</Form.Label>
                                <Form.Control type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                            </Form.Group>
                            <div className="d-flex gap-2">
                                <Button variant="primary" type="submit"><i className="bi bi-key me-1"></i>Update Password</Button>
                                <Button variant="warning" type="button" onClick={handleDefaultReset}><i className="bi bi-arrow-counterclockwise me-1"></i>Reset to Default (Teacher ID)</Button>
                            </div>
                        </Form>
                    </Tab>
                    <Tab eventKey="courses" title="Courses">
                        {loadingCourses ? <Spinner animation="border" size="sm" /> : (
                            courses.length === 0 ? <p className="text-muted">No courses found.</p> : (
                                <ListGroup>
                                    {courses.map(course => (
                                        <ListGroup.Item key={course.id} className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <strong>{course.name}</strong> <small className="text-muted">({course.code})</small>
                                            </div>
                                            <Button size="sm" variant="outline-primary" onClick={() => {
                                                onHide();
                                                navigate(`/teacher/course/${course.id}`);
                                            }}><i className="bi bi-eye me-1"></i>View Course</Button>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )
                        )}
                    </Tab>
                </Tabs>
            </Modal.Body>
        </Modal>
    );
};

const TeacherManager = () => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', content: '' });
    const [searchQuery, setSearchQuery] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const pageSize = 5; // Small size for demonstration

    const [teacherData, setTeacherData] = useState({
        username: '',
        email: '',
        password: '',
        fullName: '',
        role: 'ROLE_TEACHER',
        teacherId: '',
        position: '',
        department: '',
        faculty: 'Science'
    });

    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [showModal, setShowModal] = useState(false);

    const openTeacherDetails = (teacher: Teacher) => {
        setSelectedTeacher(teacher);
        setShowModal(true);
    };

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            // Use paginated endpoint
            const res = await api.get(`/api/teachers/all?page=${currentPage}&size=${pageSize}`);
            setTeachers(res.data.content);
            setTotalPages(res.data.totalPages);
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to fetch teachers' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, [currentPage]); // Refetch when page changes

    const handleChange = (e: React.ChangeEvent<any>) => {
        const { name, value } = e.target;
        setTeacherData(prev => {
            const newData = { ...prev, [name]: value };
            // Reset department if faculty changes
            if (name === 'faculty') {
                newData.department = '';
            }
            return newData;
        });
    };

    const handleCreateTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg({ type: '', content: '' });
        try {
            // Ensure username is set
            const payload = { 
                ...teacherData, 
                username: teacherData.email
            };
            
            await api.post('/api/teachers/add', payload);
            setMsg({ type: 'success', content: 'Teacher created successfully' });
            setTeacherData({
                username: '',
                email: '',
                password: '',
                fullName: '',
                role: 'ROLE_TEACHER',
                teacherId: '',
                position: '',
                department: '',
                faculty: 'Science'
            });
            fetchTeachers();
        } catch (err: any) {
            console.error(err);
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Failed to create teacher' });
        }
    };

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setTeacherToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!teacherToDelete) return;
        try {
            await api.delete(`/api/admin/${teacherToDelete}`);
            fetchTeachers();
            setMsg({ type: 'success', content: 'Teacher deleted successfully' });
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to delete teacher' });
        } finally {
            setShowDeleteModal(false);
            setTeacherToDelete(null);
        }
    };

    const filteredTeachers = teachers.filter(t => 
        t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.teacherId && t.teacherId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.department && t.department.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handlePageChange = (page: number) => {
        if (page >= 0 && page < totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <Row>
            <Col md={5}>
                 <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-primary text-white"><i className="bi bi-person-plus-fill me-2"></i>Create New Teacher</Card.Header>
                    <Card.Body>
                        {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
                        <Form onSubmit={handleCreateTeacher}>
                            <Form.Group className="mb-2">
                                <Form.Label>Full Name</Form.Label>
                                <Form.Control type="text" name="fullName" value={teacherData.fullName} onChange={handleChange} required />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Teacher ID</Form.Label>
                                <Form.Control type="text" name="teacherId" value={teacherData.teacherId} onChange={handleChange} required placeholder="e.g. SC/T/2023/001" />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Email</Form.Label>
                                <Form.Control type="email" name="email" value={teacherData.email} onChange={handleChange} required />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Password</Form.Label>
                                <Form.Control type="password" name="password" value={teacherData.password} onChange={handleChange} required />
                            </Form.Group>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Faculty</Form.Label>
                                        <Form.Select name="faculty" value={teacherData.faculty} onChange={handleChange}>
                                            {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Department</Form.Label>
                                        <Form.Select 
                                            name="department" 
                                            value={teacherData.department} 
                                            onChange={handleChange} 
                                            required
                                            disabled={!teacherData.faculty}
                                        >
                                            <option value="">Select Department</option>
                                            {teacherData.faculty && facultyDepartments[teacherData.faculty]?.map(dept => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                             <Form.Group className="mb-3">
                                <Form.Label>Position</Form.Label>
                                <Form.Select 
                                    name="position" 
                                    value={teacherData.position} 
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="">Select Position</option>
                                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                                </Form.Select>
                            </Form.Group>
                            
                            <Button variant="primary" type="submit" className="w-100"><i className="bi bi-check-circle-fill me-1"></i>Create Teacher</Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Col>
            <Col md={7}>
                <Card className="shadow-sm">
                    <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                        <span className="h5 mb-0"><i className="bi bi-list-ul me-2"></i>Teacher List</span>
                         <InputGroup style={{ maxWidth: '250px' }} size="sm">
                            <Form.Control
                                placeholder="Search Name/ID/Dept"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </InputGroup>
                    </Card.Header>
                    <Card.Body className="p-0">
                         {loading ? (
                            <div className="text-center p-5"><Spinner animation="border" /></div>
                        ) : (
                            <>
                                <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                    <Table hover striped className="mb-0">
                                        <thead className="table-light sticky-top">
                                            <tr>
                                                <th>ID</th>
                                                <th>Name/Position</th>
                                                <th>Dept/Faculty</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTeachers.length === 0 ? (
                                                <tr><td colSpan={4} className="text-center p-4 text-muted">No teachers found.</td></tr>
                                            ) : (
                                                filteredTeachers.map(teacher => (
                                                    <tr key={teacher.id}>
                                                        <td><Badge bg="warning" text="dark">{teacher.teacherId || 'N/A'}</Badge></td>
                                                        <td>
                                                            <div 
                                                                style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }} 
                                                                onClick={() => openTeacherDetails(teacher)}
                                                            >
                                                                {teacher.fullName}
                                                            </div>
                                                            <small className="text-muted">{teacher.position}</small>
                                                        </td>
                                                        <td>
                                                            <div>{teacher.department}</div>
                                                            <small className="text-muted">{teacher.faculty}</small>
                                                        </td>
                                                        <td>
                                                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteClick(teacher.id)}><i className="bi bi-trash"></i></Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                                <div className="d-flex justify-content-center p-3">
                                    <Pagination>
                                        <Pagination.First onClick={() => handlePageChange(0)} disabled={currentPage === 0} />
                                        <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} />
                                        
                                        {[...Array(totalPages)].map((_, idx) => (
                                            <Pagination.Item key={idx} active={idx === currentPage} onClick={() => handlePageChange(idx)}>
                                                {idx + 1}
                                            </Pagination.Item>
                                        ))}
                                        
                                        <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1} />
                                        <Pagination.Last onClick={() => handlePageChange(totalPages - 1)} disabled={currentPage === totalPages - 1} />
                                    </Pagination>
                                </div>
                            </>
                        )}
                    </Card.Body>
                </Card>
            </Col>
            
            <TeacherDetailsModal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                teacher={selectedTeacher} 
                refreshTeachers={fetchTeachers} 
            />

            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Delete</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete this teacher? This action cannot be undone.
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDelete}>
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </Row>
    );
};

const scienceDegreePrograms = [
    "Electronics and Computer Science", "Physics and Electronics", "Management and Information Technology", "Applied Chemistry",
    "Physical Science", "Bio Science", "Environmental and Conservation Management", "Sport Science", "Software Engineering",
];

const StudentDetailsModal = ({ show, onHide, student, refreshStudents }: { show: boolean, onHide: () => void, student: Student | null, refreshStudents: () => void }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [msg, setMsg] = useState({ type: '', content: '' });
    const navigate = useNavigate();

    // Edit State
    const [editData, setEditData] = useState<Partial<Student>>({});
    
    // Password State
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        if (student && show) {
            setEditData({
                fullName: student.fullName,
                email: student.email,
                studentId: student.studentId,
                faculty: student.faculty,
                degreeProgram: student.degreeProgram
            });
            setMsg({ type: '', content: '' });
            setNewPassword('');
            fetchCourses();
        }
    }, [student, show]);

    const fetchCourses = async () => {
        if (!student) return;
        setLoadingCourses(true);
        try {
            const res = await api.get(`/api/students/${student.id}/courses`);
            setCourses(res.data);
        } catch (err) {
            console.error("Failed to fetch courses", err);
        } finally {
            setLoadingCourses(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!student) return;
        try {
            await api.put(`/api/students/update/${student.id}`, editData);
            setMsg({ type: 'success', content: 'Student updated successfully' });
            refreshStudents();
        } catch (err: any) {
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Update failed' });
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!student) return;
        try {
            await api.post('/api/admin/reset-password', { userId: student.id, newPassword });
            setMsg({ type: 'success', content: 'Password updated successfully' });
            setNewPassword('');
        } catch (err: any) {
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Update failed' });
        }
    };

    const handleDefaultReset = async () => {
        if (!student) return;
        if (!window.confirm(`Are you sure you want to reset password to default? Default is the Student ID: ${student.studentId}`)) return;
        try {
            // Default password is the student ID
            await api.post('/api/admin/reset-password', { userId: student.id, newPassword: student.studentId });
            setMsg({ type: 'success', content: `Password reset to default: ${student.studentId}` });
        } catch (err: any) {
             setMsg({ type: 'danger', content: err.response?.data?.message || 'Reset failed' });
        }
    };

    if (!student) return null;

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Student Details: {student.fullName}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
                <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'details')} className="mb-3">
                    <Tab eventKey="details" title="Details">
                        <Form onSubmit={handleUpdate}>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Full Name</Form.Label>
                                        <Form.Control type="text" value={editData.fullName || ''} onChange={e => setEditData({...editData, fullName: e.target.value})} required />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Email</Form.Label>
                                        <Form.Control type="email" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} required />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Student ID</Form.Label>
                                        <Form.Control type="text" value={editData.studentId || ''} onChange={e => setEditData({...editData, studentId: e.target.value})} />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Faculty</Form.Label>
                                        <Form.Select 
                                            value={editData.faculty || ''} 
                                            onChange={e => {
                                                const newFaculty = e.target.value;
                                                setEditData(prev => ({
                                                    ...prev, 
                                                    faculty: newFaculty,
                                                    degreeProgram: '' // Reset degree if faculty changes
                                                }));
                                            }}
                                        >
                                            {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                             <Form.Group className="mb-3">
                                <Form.Label>Degree Program</Form.Label>
                                <Form.Select 
                                    value={editData.degreeProgram || ''} 
                                    onChange={e => setEditData(prev => ({...prev, degreeProgram: e.target.value}))}
                                    disabled={editData.faculty !== "Science"}
                                >
                                    <option value="">Select Degree Program</option>
                                    {scienceDegreePrograms.map(d => <option key={d} value={d}>{d}</option>)}
                                </Form.Select>
                                {editData.faculty !== "Science" && <Form.Text className="text-muted">Only available for Science faculty currently.</Form.Text>}
                            </Form.Group>
                            <Button variant="primary" type="submit"><i className="bi bi-save me-1"></i>Update Details</Button>
                        </Form>
                    </Tab>
                    <Tab eventKey="password" title="Security">
                        <Form onSubmit={handleUpdatePassword}>
                            <Form.Group className="mb-3">
                                <Form.Label>New Password</Form.Label>
                                <Form.Control type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                            </Form.Group>
                            <div className="d-flex gap-2">
                                <Button variant="primary" type="submit"><i className="bi bi-key me-1"></i>Update Password</Button>
                                <Button variant="warning" type="button" onClick={handleDefaultReset}><i className="bi bi-arrow-counterclockwise me-1"></i>Reset to Default (Student ID)</Button>
                            </div>
                        </Form>
                    </Tab>
                    <Tab eventKey="courses" title="Enrolled Courses">
                        {loadingCourses ? <Spinner animation="border" size="sm" /> : (
                            courses.length === 0 ? <p className="text-muted">No enrolled courses found.</p> : (
                                <ListGroup>
                                    {courses.map(course => (
                                        <ListGroup.Item key={course.id} className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <strong>{course.name}</strong> <small className="text-muted">({course.code})</small>
                                            </div>
                                            <Button size="sm" variant="outline-primary" onClick={() => {
                                                onHide();
                                                navigate(`/teacher/course/${course.id}`);
                                            }}><i className="bi bi-eye me-1"></i>View Course</Button>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )
                        )}
                    </Tab>
                </Tabs>
            </Modal.Body>
        </Modal>
    );
};

import { GoogleMap, useJsApiLoader, DrawingManager } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '300px'
};

const defaultCenter = {
  lat: 7.2906, 
  lng: 80.6337
};

interface Session {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    courseId: string;
    boundary?: any[];
}

const SessionDetailsModal = ({ show, onHide, session, course, refreshSessions }: { show: boolean, onHide: () => void, session: Session | null, course: Course | null, refreshSessions: () => void }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [msg, setMsg] = useState({ type: '', content: '' });
    const [attendanceList, setAttendanceList] = useState<any[]>([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [editData, setEditData] = useState<Partial<Session>>({});
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Map State
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyA2eLFexIQfCqji9Tgrb73vKVJh0Fm_RXs",
        libraries: ['drawing', 'geometry']
    });

    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const rectRef = React.useRef<any>(null);

    // Manual Mark State
    const [showManualMark, setShowManualMark] = useState(false);
    const [manualStudentId, setManualStudentId] = useState('');
    const [manualNote, setManualNote] = useState('');
    const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);

    useEffect(() => {
        if (session && show) {
            setEditData({
                title: session.title,
                startTime: session.startTime,
                endTime: session.endTime,
                boundary: session.boundary || []
            });
            setMsg({ type: '', content: '' });
            fetchAttendance();
            fetchEnrolledStudents();
            
            // Try to get user location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setMapCenter({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    }
                );
            }
        }
    }, [session, show]);

    const onLoad = React.useCallback(function callback() {
    }, []);

    const onUnmount = React.useCallback(function callback() {
    }, []);

    const onRectangleComplete = (rect: any) => {
        const bounds = rect.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        const corners = [
            { lat: ne.lat(), lng: ne.lng() }, 
            { lat: sw.lat(), lng: ne.lng() }, 
            { lat: sw.lat(), lng: sw.lng() }, 
            { lat: ne.lat(), lng: sw.lng() }  
        ];
        
        setEditData(prev => ({ ...prev, boundary: corners }));
        
        if (rectRef.current) {
            rectRef.current.setMap(null);
        }
        rectRef.current = rect;
    };

    const fetchAttendance = async () => {
        if (!session) return;
        setLoadingAttendance(true);
        try {
            const res = await api.get(`/api/attendance/session/${session.id}`);
            setAttendanceList(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const fetchEnrolledStudents = async () => {
        if (!course) return;
        try {
             const res = await api.get(`/api/courses/${course.id}/students`);
             setEnrolledStudents(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session) return;
        try {
            await api.put(`/api/sessions/update/${session.id}`, editData);
            setMsg({ type: 'success', content: 'Session updated successfully' });
            refreshSessions();
        } catch (err: any) {
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Update failed' });
        }
    };

    const handleManualMark = async () => {
        if (!manualStudentId || !session) return;
        try {
            await api.post('/api/attendance/manual-mark', {
                sessionId: session.id,
                studentId: manualStudentId,
                note: manualNote
            });
            setMsg({ type: 'success', content: 'Attendance marked successfully' });
            setShowManualMark(false);
            setManualStudentId('');
            setManualNote('');
            fetchAttendance();
        } catch (err: any) {
             setMsg({ type: 'danger', content: err.response?.data?.message || 'Manual mark failed' });
        }
    };

    const handleDownloadExcel = async () => {
        if (!session || attendanceList.length === 0) return;
        setIsDownloading(true);
        try {
            const response = await api.get(`/api/attendance/session/${session.id}/export`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${course?.code}_${session.title}_Attendance.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error(err);
            alert("Failed to download attendance.");
        } finally {
            setIsDownloading(false);
        }
    };

    if (!session) return null;

    const isExpired = session.status === 'EXPIRED';

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Session: {session.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
                <div className="mb-3">
                    <Badge bg={session.status === 'ACTIVE' ? 'success' : session.status === 'SCHEDULED' ? 'primary' : session.status === 'EXPIRED' ? 'secondary' : 'danger'}>
                        {session.status}
                    </Badge>
                </div>
                
                <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'details')} className="mb-3">
                    <Tab eventKey="details" title="Details">
                        <Form onSubmit={handleUpdate}>
                            <Form.Group className="mb-2">
                                <Form.Label>Title</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    value={editData.title || ''} 
                                    onChange={e => setEditData({...editData, title: e.target.value})} 
                                    disabled={isExpired}
                                    required 
                                />
                            </Form.Group>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Start Time</Form.Label>
                                        <Form.Control 
                                            type="datetime-local" 
                                            value={editData.startTime ? new Date(editData.startTime).toISOString().slice(0, 16) : ''} 
                                            onChange={e => setEditData({...editData, startTime: e.target.value})} 
                                            disabled={isExpired}
                                            required 
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>End Time</Form.Label>
                                        <Form.Control 
                                            type="datetime-local" 
                                            value={editData.endTime ? new Date(editData.endTime).toISOString().slice(0, 16) : ''} 
                                            onChange={e => setEditData({...editData, endTime: e.target.value})} 
                                            disabled={isExpired}
                                            required 
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            
                            {!isExpired && (
                                <Form.Group className="mb-3 mt-3">
                                    <Form.Label>Location (Redraw to update)</Form.Label>
                                    {isLoaded ? (
                                        <GoogleMap
                                            mapContainerStyle={containerStyle}
                                            center={mapCenter}
                                            zoom={15}
                                            onLoad={onLoad}
                                            onUnmount={onUnmount}
                                        >
                                            <DrawingManager
                                                onRectangleComplete={onRectangleComplete}
                                                options={{
                                                    drawingControl: true,
                                                    drawingControlOptions: {
                                                        drawingModes: ['rectangle' as any]
                                                    },
                                                    rectangleOptions: {
                                                        editable: true,
                                                        draggable: true
                                                    }
                                                }}
                                            />
                                        </GoogleMap>
                                    ) : <Spinner animation="border" size="sm" />}
                                </Form.Group>
                            )}

                            {!isExpired && (
                                <div className="d-flex justify-content-end mt-3">
                                    <Button variant="primary" type="submit"><i className="bi bi-save me-1"></i>Update Session</Button>
                                </div>
                            )}
                            {isExpired && <p className="text-muted mt-3">This session is expired and cannot be edited.</p>}
                        </Form>
                    </Tab>
                    <Tab eventKey="attendance" title="Attendance">
                        <div className="d-flex justify-content-end mb-3 gap-2">
                             <Button variant="outline-primary" size="sm" onClick={() => setShowManualMark(!showManualMark)}>
                                {showManualMark ? <span><i className="bi bi-x-square me-1"></i>Hide Manual Mark</span> : <span><i className="bi bi-pencil-square me-1"></i>Manual Mark</span>}
                            </Button>
                            <Button variant="success" size="sm" onClick={handleDownloadExcel} disabled={isDownloading}>
                                {isDownloading ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> Downloading...</> : <><i className="bi bi-file-earmark-spreadsheet me-1"></i>Download Excel</>}
                            </Button>
                        </div>
                        
                        {/* Manual Mark and Table logic continues here... */}

                        {showManualMark && (
                            <Card className="mb-3 p-3 bg-light">
                                <h6>Manual Mark Attendance</h6>
                                <Form className="d-flex gap-2 align-items-end">
                                    <Form.Group className="flex-grow-1">
                                        <Form.Label>Student</Form.Label>
                                        <Form.Select value={manualStudentId} onChange={e => setManualStudentId(e.target.value)}>
                                            <option value="">Select Student</option>
                                            {enrolledStudents.map(s => (
                                                <option key={s.id} value={s.id}>{s.fullName} ({s.studentId})</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                    <Form.Group className="flex-grow-1">
                                        <Form.Label>Note</Form.Label>
                                        <Form.Control type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="Reason..." />
                                    </Form.Group>
                                    <Button variant="primary" onClick={handleManualMark} disabled={!manualStudentId}><i className="bi bi-check-lg me-1"></i>Mark</Button>
                                </Form>
                            </Card>
                        )}

                        {loadingAttendance ? <Spinner animation="border" /> : (
                            <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                <Table striped size="sm">
                                    <thead><tr><th>Student</th><th>Status</th><th>Time</th><th>Notes</th></tr></thead>
                                    <tbody>
                                        {enrolledStudents.map(student => {
                                            const record = attendanceList.find((a: any) => a.studentId === student.id || a.studentId === student.studentId);
                                            const isPresent = record && record.status === 'PRESENT';
                                            return (
                                                <tr key={student.id}>
                                                    <td>{student.fullName} <small className="text-muted">({student.studentId})</small></td>
                                                    <td>
                                                        {isPresent ? <Badge bg="success">Present</Badge> : 
                                                         record?.status === 'FRAUD' ? <Badge bg="warning" text="dark">Fraud</Badge> : 
                                                         <Badge bg="danger">Absent</Badge>}
                                                        {record?.isManuallyMarked && <Badge bg="info" className="ms-1">Manual</Badge>}
                                                    </td>
                                                    <td>{record?.checkInTimes ? new Date(record.checkInTimes[0]).toLocaleTimeString() : '-'}</td>
                                                    <td>{record?.manualMarkNote || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </Tab>
                </Tabs>
            </Modal.Body>
        </Modal>
    );
};

const CourseDetailsModal = ({ show, onHide, course, refreshCourses }: { show: boolean, onHide: () => void, course: Course | null, refreshCourses: () => void }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [msg, setMsg] = useState({ type: '', content: '' });
    const [editData, setEditData] = useState<Partial<Course>>({});
    const [loadingDownload, setLoadingDownload] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    
    // Session Modal
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [showSessionModal, setShowSessionModal] = useState(false);

    useEffect(() => {
        if (course && show) {
            setEditData({
                name: course.name,
                code: course.code,
                enrollmentKey: course.enrollmentKey,
            });
            setMsg({ type: '', content: '' });
            fetchSessions();
        }
    }, [course, show]);

    const fetchSessions = async () => {
        if (!course) return;
        setLoadingSessions(true);
        try {
            const res = await api.get(`/api/sessions/course/${course.id}`);
            setSessions(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!course) return;
        try {
            await api.put(`/api/courses/update/${course.id}`, editData);
            setMsg({ type: 'success', content: 'Course updated successfully' });
            refreshCourses();
        } catch (err: any) {
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Update failed' });
        }
    };

    const handleDownloadReport = async (type: 'attendance' | 'students') => {
        if (!course) return;
        setLoadingDownload(true);
        try {
            const endpoint = type === 'attendance' ? 'export/attendance' : 'export/students';
            const filename = type === 'attendance' ? `${course.code}_attendance_matrix.xlsx` : `${course.code}_enrolled_students.xlsx`;
            
            const response = await api.get(`/api/courses/${course.id}/${endpoint}`, {
                responseType: 'blob',
            });
            
            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            setMsg({ type: 'success', content: `Report (${type}) downloaded successfully` });
        } catch (err: any) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to download report' });
        } finally {
            setLoadingDownload(false);
        }
    };

    // Session Management Handlers
    const handleDeleteSession = async (sessionId: string) => {
        if(!window.confirm("Are you sure?")) return;
        try {
            await api.delete(`/api/sessions/${sessionId}`);
            fetchSessions();
        } catch(err) {
            alert("Failed to delete session");
        }
    }

    const openSessionDetails = (session: Session) => {
        setSelectedSession(session);
        setShowSessionModal(true);
    };

    if (!course) return null;

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Course Details: {course.name}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
                <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'details')} className="mb-3">
                    <Tab eventKey="details" title="Details">
                        <Form onSubmit={handleUpdate}>
                            <Form.Group className="mb-2">
                                <Form.Label>Course Name</Form.Label>
                                <Form.Control type="text" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} required />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Course Code</Form.Label>
                                <Form.Control type="text" value={editData.code || ''} onChange={e => setEditData({...editData, code: e.target.value})} required />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Enrollment Key</Form.Label>
                                <Form.Control type="text" value={editData.enrollmentKey || ''} onChange={e => setEditData({...editData, enrollmentKey: e.target.value})} />
                            </Form.Group>
                             <div className="d-flex justify-content-end">
                                <Button variant="primary" type="submit"><i className="bi bi-save me-1"></i>Update Course</Button>
                            </div>
                        </Form>
                    </Tab>
                    <Tab eventKey="sessions" title={`Sessions (${sessions.length})`}>
                       {loadingSessions ? <Spinner animation="border"/> : (
                           <div className="table-responsive" style={{maxHeight: '400px'}}>
                               <Table striped size="sm" hover>
                                   <thead><tr><th>Date</th><th>Title</th><th>Status</th><th>Action</th></tr></thead>
                                   <tbody>
                                       {sessions.map(s => (
                                           <tr key={s.id} style={{cursor: 'pointer'}} onClick={() => openSessionDetails(s)}>
                                               <td>{new Date(s.startTime).toLocaleDateString()}</td>
                                               <td>{s.title}</td>
                                               <td><Badge bg={s.status === 'ACTIVE' ? 'success' : s.status === 'SCHEDULED' ? 'primary' : 'secondary'}>{s.status}</Badge></td>
                                               <td>
                                                   <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}>Delete</Button>
                                               </td>
                                           </tr>
                                       ))}
                                   </tbody>
                               </Table>
                               <div className="text-muted small mt-2">
                                   * Click on a row to view/edit details.
                               </div>
                           </div>
                       )}
                    </Tab>
                    <Tab eventKey="reports" title="Reports">
                        <div className="d-grid gap-3 p-3">
                            <Card className="text-center p-3">
                                <h6>Attendance Matrix</h6>
                                <p className="text-muted small">Session-wise attendance for all students.</p>
                                <Button variant="success" onClick={() => handleDownloadReport('attendance')} disabled={loadingDownload}>
                                    {loadingDownload ? <Spinner animation="border" size="sm" /> : <span><i className="bi bi-download me-1"></i>Download Attendance Matrix</span>}
                                </Button>
                            </Card>
                            
                            <Card className="text-center p-3">
                                <h6>Enrolled Students</h6>
                                <p className="text-muted small">List of all currently enrolled students.</p>
                                <Button variant="info" className="text-white" onClick={() => handleDownloadReport('students')} disabled={loadingDownload}>
                                    {loadingDownload ? <Spinner animation="border" size="sm" /> : <span><i className="bi bi-download me-1"></i>Download Student List</span>}
                                </Button>
                            </Card>
                        </div>
                    </Tab>
                </Tabs>
            </Modal.Body>
            
            <SessionDetailsModal 
                show={showSessionModal}
                onHide={() => setShowSessionModal(false)}
                session={selectedSession}
                course={course}
                refreshSessions={fetchSessions}
            />
        </Modal>
    );
};

const CourseManager = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]); // simplified for now
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', content: '' });
    
    // Create Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        teacherId: '',
        enrollmentKey: '',
        academicYear: '',
        semester: ''
    });

    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showModal, setShowModal] = useState(false);

    const openCourseDetails = (course: Course) => {
        setSelectedCourse(course);
        setShowModal(true);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [coursesRes, usersRes] = await Promise.all([
                api.get('/api/courses'),
                api.get('/api/admin/all')
            ]);
            setCourses(coursesRes.data);
            setTeachers(usersRes.data.filter((u: any) => u.role === 'ROLE_TEACHER'));
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to fetch data' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Fetch System Settings
        api.get('/api/system/general').then(res => {
            setFormData(prev => ({
                ...prev,
                academicYear: res.data.academicYear || '',
                semester: res.data.semester || ''
            }));
        }).catch(err => console.error("Failed to fetch system settings", err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | any>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg({ type: '', content: '' });
        try {
            await api.post(`/api/courses/admin/create?teacherId=${formData.teacherId}`, {
                name: formData.name,
                code: formData.code,
                enrollmentKey: formData.enrollmentKey,
                academicYear: formData.academicYear,
                semester: formData.semester
            });
            setMsg({ type: 'success', content: 'Course created successfully' });
            setFormData({ name: '', code: '', teacherId: '', enrollmentKey: '', academicYear: formData.academicYear, semester: formData.semester }); // Keep defaults
            fetchData();
        } catch (err: any) {
            console.error(err);
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Failed to create course' });
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        if (!window.confirm("Are you sure you want to delete this course?")) return;
        try {
            await api.delete(`/api/courses/${id}`);
            setCourses(prev => prev.filter(c => c.id !== id));
            setMsg({ type: 'success', content: 'Course deleted successfully' });
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to delete course' });
        }
    };

    return (
        <Row>
            <Col lg={4} className="mb-4">
                 <Card className="shadow-sm">
                    <Card.Header className="bg-primary text-white"><i className="bi bi-journal-plus me-2"></i>Create New Course</Card.Header>
                    <Card.Body>
                        {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
                        <Form onSubmit={handleCreateCourse}>
                            <Form.Group className="mb-2">
                                <Form.Label>Course Name</Form.Label>
                                <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Course Code</Form.Label>
                                <Form.Control type="text" name="code" value={formData.code} onChange={handleChange} required />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Enrollment Key (Optional)</Form.Label>
                                <Form.Control type="text" name="enrollmentKey" value={formData.enrollmentKey} onChange={handleChange} placeholder="Leave empty if none" />
                            </Form.Group>
                             <Form.Group className="mb-3">
                                <Form.Label>Assign Teacher</Form.Label>
                                <Form.Select name="teacherId" value={formData.teacherId} onChange={handleChange} required>
                                    <option value="">Select Teacher</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                                </Form.Select>
                            </Form.Group>
                            <Button variant="primary" type="submit" className="w-100"><i className="bi bi-check-circle-fill me-1"></i>Create Course</Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Col>
            
            <Col lg={8}>
                <Card className="shadow-sm">
                    <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                        <span className="h5 mb-0"><i className="bi bi-list-ul me-2"></i>Course List</span>
                        <Badge bg="secondary">{courses.length} Courses</Badge>
                    </Card.Header>
                    <Card.Body className="p-0">
                        {loading ? (
                            <div className="text-center p-5"><Spinner animation="border" /></div>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                <Table hover striped className="mb-0">
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th>Code</th>
                                            <th>Name</th>
                                            <th>Teacher</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {courses.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center p-4 text-muted">No courses found.</td></tr>
                                        ) : (
                                            courses.map(course => (
                                                <tr key={course.id} onClick={() => openCourseDetails(course)} style={{ cursor: 'pointer' }}>
                                                    <td><Badge bg="secondary">{course.code}</Badge></td>
                                                    <td>{course.name}</td>
                                                    <td>{course.teacherName}</td>
                                                    <td>
                                                        <Button variant="outline-danger" size="sm" onClick={(e) => handleDelete(course.id, e)}><i className="bi bi-trash"></i></Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            </Col>

            <CourseDetailsModal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                course={selectedCourse} 
                refreshCourses={fetchData} 
            />
        </Row>
    );
};

interface Student {
    id: string;
    fullName: string;
    email: string;
    studentId?: string;
    faculty?: string;
    degreeProgram?: string;
}

const StudentManager = () => {


    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', content: '' });
    const [searchQuery, setSearchQuery] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const pageSize = 5;

    // Create Form State
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        faculty: 'Science',
        degreeProgram: ''
    });

    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [showModal, setShowModal] = useState(false);

    const openStudentDetails = (student: Student) => {
        setSelectedStudent(student);
        setShowModal(true);
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            // Use new paginated endpoint
            const res = await api.get(`/api/students/all?page=${currentPage}&size=${pageSize}`);
            setStudents(res.data.content);
            setTotalPages(res.data.totalPages);
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to fetch students' });
        } finally {
            setLoading(false);
        }
    };

    // Client-side search for now (or could implement server-side search endpoint later)
    // The previous implementation had a search endpoint, let's keep it but simpler for now
    // Actually, asking backend for search is better if we have it, but for now user asked for pagination on main list.
    // If search is used, we might need to handle pagination differently or disable it.
    // Let's stick to the paginated fetch for the main view.
    // If search query is present, we should probably call the search endpoint (which returns a list, not page).
    
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            fetchStudents();
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('query', searchQuery);
            // We can add faculty/degree filters later if needed, keeping it simple for now as requested
            
            const res = await api.get(`/api/admin/students/search?${params.toString()}`);
            setStudents(res.data);
            setTotalPages(1); // Search results are usually not paginated in this simple implementation
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to search students' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!searchQuery) {
            fetchStudents();
        }
    }, [currentPage, searchQuery]); // Refetch when page changes

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg({ type: '', content: '' });
        try {
            // Remove department from payload implicitly by not sending it or backend ignoring it
            // formData doesn't have department anymore
            await api.post('/api/admin/students', formData);
            setMsg({ type: 'success', content: 'Student created successfully' });
            setFormData({
                fullName: '',
                email: '',
                password: '',
                faculty: 'Science',
                degreeProgram: ''
            });
            fetchStudents();
        } catch (err: any) {
            console.error(err);
            setMsg({ type: 'danger', content: err.response?.data?.message || 'Failed to create student' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this student?")) return;
        try {
            await api.delete(`/api/admin/${id}`);
            setStudents(prev => prev.filter(s => s.id !== id));
            setMsg({ type: 'success', content: 'Student deleted successfully' });
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', content: 'Failed to delete student' });
        }
    };

    const handlePageChange = (page: number) => {
        if (page >= 0 && page < totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <Row>
            <Col lg={4} className="mb-4">
                 <Card className="shadow-sm">
                    <Card.Header className="bg-primary text-white"><i className="bi bi-person-plus-fill me-2"></i>Create New Student</Card.Header>
                    <Card.Body>
                        {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
                        <Form onSubmit={handleCreateStudent}>
                            <Form.Group className="mb-2">
                                <Form.Label>Full Name</Form.Label>
                                <Form.Control type="text" name="fullName" value={formData.fullName} onChange={handleChange} required />
                            </Form.Group>

                             <Form.Group className="mb-2">
                                <Form.Label>Email</Form.Label>
                                <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} required />
                            </Form.Group>
                             <Form.Group className="mb-2">
                                <Form.Label>Password</Form.Label>
                                <Form.Control type="password" name="password" value={formData.password} onChange={handleChange} required />
                            </Form.Group>
                            <Row>
                                <Col md={12}>
                                    <Form.Group className="mb-2">
                                        <Form.Label>Faculty</Form.Label>
                                        <Form.Select name="faculty" value={formData.faculty} onChange={e => handleChange(e as any)}>
                                            {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Form.Group className="mb-3">
                                <Form.Label>Degree Program</Form.Label>
                                <Form.Select 
                                    name="degreeProgram" 
                                    value={formData.degreeProgram} 
                                    onChange={e => handleChange(e as any)}
                                    disabled={formData.faculty !== "Science"}
                                >
                                    <option value="">Select Degree Program</option>
                                    {scienceDegreePrograms.map(d => <option key={d} value={d}>{d}</option>)}
                                </Form.Select>
                                {formData.faculty !== "Science" && <Form.Text className="text-muted">Only available for Science faculty currently.</Form.Text>}
                            </Form.Group>
                            <Button variant="primary" type="submit" className="w-100"><i className="bi bi-check-circle-fill me-1"></i>Create Student</Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Col>
            
            <Col lg={8}>
                <Card className="shadow-sm">
                    <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                        <span className="h5 mb-0"><i className="bi bi-list-ul me-2"></i>Student List</span>
                        <div className="d-flex align-items-center">
                            <InputGroup className="me-3" style={{ maxWidth: '300px' }}>
                                <Form.Control
                                    placeholder="Search Name / ID"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button variant="outline-primary" onClick={handleSearch}><i className="bi bi-search me-1"></i>Search</Button>
                            </InputGroup>
                        </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                        {loading ? (
                            <div className="text-center p-5"><Spinner animation="border" /></div>
                        ) : (
                            <>
                                <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                    <Table hover striped className="mb-0">
                                        <thead className="table-light sticky-top">
                                            <tr>
                                                <th>ID</th>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Faculty/Degree</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.length === 0 ? (
                                                <tr><td colSpan={5} className="text-center p-4 text-muted">No students found.</td></tr>
                                            ) : (
                                                students.map(student => (
                                                    <tr key={student.id}>
                                                        <td><Badge bg="info">{student.studentId || 'N/A'}</Badge></td>
                                                        <td>
                                                            <div 
                                                                style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }} 
                                                                onClick={() => openStudentDetails(student)}
                                                            >
                                                                {student.fullName}
                                                            </div>
                                                        </td>
                                                        <td>{student.email}</td>
                                                        <td>
                                                            <small>{student.faculty}</small><br/>
                                                            <small className="text-muted">{student.degreeProgram}</small>
                                                        </td>
                                                        <td>
                                                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(student.id)}><i className="bi bi-trash"></i></Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                                <div className="d-flex justify-content-center p-3">
                                    <Pagination>
                                        <Pagination.First onClick={() => handlePageChange(0)} disabled={currentPage === 0} />
                                        <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} />
                                        
                                        {[...Array(totalPages)].map((_, idx) => (
                                            <Pagination.Item key={idx} active={idx === currentPage} onClick={() => handlePageChange(idx)}>
                                                {idx + 1}
                                            </Pagination.Item>
                                        ))}
                                        
                                        <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1} />
                                        <Pagination.Last onClick={() => handlePageChange(totalPages - 1)} disabled={currentPage === totalPages - 1} />
                                    </Pagination>
                                </div>
                            </>
                        )}
                    </Card.Body>
                </Card>
            </Col>

            <StudentDetailsModal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                student={selectedStudent} 
                refreshStudents={fetchStudents} 
            />
        </Row>
    );
};

const TimezoneSettings = () => {
    const [timezone, setTimezone] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', content: '' });

    const timezones = [
        "Asia/Colombo",
        "UTC",
        "Asia/Kolkata",
        "America/New_York",
        "Europe/London",
        "Australia/Sydney"
    ];

    useEffect(() => {
        fetchTimezone();
    }, []);

    const fetchTimezone = async () => {
        try {
            const res = await api.get('/api/system/timezone');
            setTimezone(res.data.timezone);
        } catch (err) {
            console.error("Failed to fetch timezone", err);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ type: '', content: '' });
        try {
            await api.post('/api/system/timezone', { timezone });
            setMsg({ type: 'success', content: 'Timezone updated successfully' });
        } catch (err: any) {
            setMsg({ type: 'danger', content: 'Failed to update timezone' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form onSubmit={handleUpdate}>
            {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
            <Form.Group className="mb-3">
                <Form.Label>System Timezone</Form.Label>
                <Form.Select value={timezone} onChange={e => setTimezone(e.target.value)}>
                    {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </Form.Select>
                <Form.Text className="text-muted">
                    This affects how dates and times are stored and displayed.
                </Form.Text>
            </Form.Group>
            <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : 'Update Timezone'}
            </Button>
        </Form>
    );
};

const GeneralSettings = () => {
    const [settings, setSettings] = useState({
        academicYear: '',
        semester: '',
        attendanceThreshold: 80,
        sessionDuration: 60
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', content: '' });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/api/system/general');
            setSettings(res.data);
        } catch (err) {
            console.error("Failed to fetch settings", err);
        }
    };

    const handleChange = (e: React.ChangeEvent<any>) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ type: '', content: '' });
        try {
            await api.post('/api/system/general', settings);
            setMsg({ type: 'success', content: 'Settings updated successfully' });
        } catch (err: any) {
            setMsg({ type: 'danger', content: 'Failed to update settings' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form onSubmit={handleUpdate}>
            {msg.content && <Alert variant={msg.type} dismissible onClose={() => setMsg({ type: '', content: '' })}>{msg.content}</Alert>}
            <Row>
                <Col md={6}>
                    <Form.Group className="mb-3">
                        <Form.Label>Academic Year</Form.Label>
                        <Form.Control type="text" name="academicYear" value={settings.academicYear} onChange={handleChange} placeholder="e.g. 2023/2024" required />
                    </Form.Group>
                </Col>
                <Col md={6}>
                    <Form.Group className="mb-3">
                        <Form.Label>Semester</Form.Label>
                        <Form.Select name="semester" value={settings.semester} onChange={handleChange}>
                            <option value="Semester 1">Semester 1</option>
                            <option value="Semester 2">Semester 2</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
            <Row>
                <Col md={6}>
                    <Form.Group className="mb-3">
                        <Form.Label>Attendance Threshold (%)</Form.Label>
                        <Form.Control type="number" name="attendanceThreshold" value={settings.attendanceThreshold} onChange={handleChange} min={0} max={100} required />
                        <Form.Text className="text-muted">Minimum % for good standing</Form.Text>
                    </Form.Group>
                </Col>
                <Col md={6}>
                    <Form.Group className="mb-3">
                        <Form.Label>Default Session Duration (mins)</Form.Label>
                        <Form.Control type="number" name="sessionDuration" value={settings.sessionDuration} onChange={handleChange} min={15} required />
                    </Form.Group>
                </Col>
            </Row>
            <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : 'Save Changes'}
            </Button>
        </Form>
    );
};

export default AdminDashboard;
