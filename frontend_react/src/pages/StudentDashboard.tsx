import React, { useEffect, useState, useContext } from 'react';
import { Container, Tabs, Tab, Button, Alert, Spinner, Badge, Card, Row, Col, Modal, Form, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

interface Course {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  teacherName: string;
  hasEnrollmentKey: boolean;
  isArchived?: boolean;
  academicYear?: string;
  semester?: string;
}

const StudentDashboard: React.FC = () => {
  const user = useContext(AuthContext)?.user;

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all courses from the backend
  const fetchCourses = async () => {
    try {
      const res = await api.get('/api/courses');
      setCourses(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load courses');
    }
  };

  // Fetch courses the student is enrolled in (expects array of courses)
  const fetchEnrolledCourses = async () => {
    try {
      const res = await api.get<Course[]>('/api/courses/enrolled');
      setEnrolledCourseIds(res.data.map(c => c.id));
    } catch (err) {
      console.error(err);
    }
  };
  
// On mount: load both all courses and enrolled courses in parallel
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCourses(), fetchEnrolledCourses()]);
      setLoading(false);
    };
    init();
  }, []);

  /* New State for Enrollment Modal */
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  
  const [currentTerm, setCurrentTerm] = useState('');
  
// Fetch system general settings to show current academic term (year + semester)
  useEffect(() => {
      api.get('/api/system/general').then(res => {
          if (res.data.academicYear && res.data.semester) {
              setCurrentTerm(`${res.data.academicYear} - ${res.data.semester}`);
          }
      }).catch(err => console.error("Failed to fetch system settings", err));
  }, []);

  // Account State(Change Password modal)
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
// Handler to change password: validates and posts to API
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    setPassError('');

    if (newPassword !== confirmPassword) {
      setPassError("New passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.post('/api/users/change-password', {
        oldPassword,
        newPassword,
        confirmNewPassword: confirmPassword
      });
      setPassMsg("Password changed successfully");
      // clear fields and close modal after a short delay
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err: any) {
       console.error(err);
       setPassError(err.response?.data?.message || "Failed to change password");
    } finally {
       setIsUpdatingPassword(false);
    }
  };

  // Called when user clicks enroll on a course; if a key is required open modal, otherwise enroll directly
  const handleEnrollClick = (course: Course) => {
      if (course.hasEnrollmentKey) {
          setSelectedCourse(course);
          setEnrollmentKey('');
          setEnrollError('');
          setShowEnrollModal(true);
      } else {
          submitEnrollment(course.id, null);
      }
  };
  
// Submit enrollment to API; accepts optional key
  const submitEnrollment = async (courseId: string, key: string | null) => {
    setIsEnrolling(true);
    try {
      setError('');
      setSuccess('');
      setEnrollError('');
      
      await api.post(`/api/courses/${courseId}/enroll${key ? `?key=${key}` : ''}`);
      setSuccess('Enrolled successfully!');
      setShowEnrollModal(false);
      fetchEnrolledCourses();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Enrollment failed';
      if (key) {
           setEnrollError(msg);
      } else {
           setError(msg); // show global error
      }
      console.error(err);
    } finally {
      setIsEnrolling(false);
    }
  };
  
// Utility to check if current student is enrolled in a course
  const isEnrolled = (courseId: string) => enrolledCourseIds.includes(courseId);
  
// Archive a course for the student (PUT request) and update local UI state
  const handleArchiveCourse = async (courseId: string) => {
      try {
          await api.put(`/api/students/courses/${courseId}/archive`);
          // Update local state
          setCourses(courses.map(c => {
              if (c.id === courseId) return { ...c, isArchived: true };
              return c;
          }));
      } catch (err) {
          console.error(err);
          alert("Failed to archive course");
      }
  };
  
// Unarchive a course and update local UI state
  const handleUnarchiveCourse = async (courseId: string) => {
      try {
          await api.put(`/api/students/courses/${courseId}/unarchive`);
          // Update local state
          setCourses(courses.map(c => {
              if (c.id === courseId) return { ...c, isArchived: false };
              return c;
          }));
      } catch (err) {
          console.error(err);
          alert("Failed to unarchive course");
      }
  };



  return (
    <Container className="mt-5">
       <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 className="page-title mb-0">Student Dashboard</h2>
            {currentTerm && <Badge bg="primary" className="text-white mt-2">{currentTerm}</Badge>}
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      {loading ? (
         <div className="text-center mt-5"><Spinner animation="border" variant="primary" /></div>
      ) : (
        <Tabs defaultActiveKey="all_courses" id="student-tabs" className="mb-3 justify-content-center">
          <Tab eventKey="all_courses" title="All Courses">
            <Form.Group className="mb-3 mt-3 w-50 mx-auto">
                 <Form.Control
                    type="text"
                    placeholder="Search by Course Code or Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
            </Form.Group>
            <Row className="g-4 mt-2">
              {courses.filter(c => 
                  c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  c.code.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(course => (
                        <CourseCard 
                            key={course.id} 
                            course={course} 
                            isEnrolled={isEnrolled(course.id)}
                            onArchive={() => handleArchiveCourse(course.id)}
                            onUnarchive={() => handleUnarchiveCourse(course.id)}
                            onEnrollClick={() => handleEnrollClick(course)}
                        />
              ))}
              {courses.filter(c => 
                  c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  c.code.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && <p className="text-center text-muted">No courses found matching your search.</p>}
            </Row>
          </Tab>
          <Tab eventKey="my_courses" title="My Courses">
             <Tabs defaultActiveKey="active" className="mb-3 mt-3">
                 <Tab eventKey="active" title="Active">
                     <Row className="g-4 mt-2">
                      {courses.filter(c => isEnrolled(c.id) && !c.isArchived).map(course => (
                                <CourseCard 
                            key={course.id} 
                            course={course} 
                            isEnrolled={isEnrolled(course.id)}
                            onArchive={() => handleArchiveCourse(course.id)}
                            onUnarchive={() => handleUnarchiveCourse(course.id)}
                            onEnrollClick={() => handleEnrollClick(course)}
                        />
                      ))}
                      {courses.filter(c => isEnrolled(c.id) && !c.isArchived).length === 0 && (
                         <Col xs={12} className="text-center mt-5">
                            <p className="text-muted fs-5">No active enrolled courses.</p>
                         </Col>
                      )}
                    </Row>
                 </Tab>
                 <Tab eventKey="archived" title="Archived">
                     <Row className="g-4 mt-2">
                      {courses.filter(c => isEnrolled(c.id) && c.isArchived).map(course => (
                                <CourseCard 
                            key={course.id} 
                            course={course} 
                            isEnrolled={isEnrolled(course.id)}
                            onArchive={() => handleArchiveCourse(course.id)}
                            onUnarchive={() => handleUnarchiveCourse(course.id)}
                            onEnrollClick={() => handleEnrollClick(course)}
                        />
                      ))}
                      {courses.filter(c => isEnrolled(c.id) && c.isArchived).length === 0 && (
                         <Col xs={12} className="text-center mt-5">
                            <p className="text-muted fs-5">No archived courses.</p>
                         </Col>
                      )}
                    </Row>
                 </Tab>
             </Tabs>
          </Tab>
          <Tab eventKey="account" title="Account">
            <Row className="justify-content-center mt-4">
              <Col md={8}>
                 <Card className="mb-4">
                  <Card.Header as="h5">My Profile</Card.Header>
                  <Card.Body>
                    <Row className="mb-2">
                       <Col sm={4} className="fw-bold">Full Name:</Col>
                       <Col sm={8}>{user?.fullName}</Col>
                    </Row>
                    <Row className="mb-2">
                       <Col sm={4} className="fw-bold">Email:</Col>
                       <Col sm={8}>{user?.email}</Col>
                    </Row>
                    <Row className="mb-2">
                       <Col sm={4} className="fw-bold">Student ID:</Col>
                       <Col sm={8}>{user?.studentId || 'N/A'}</Col>
                    </Row>
                     <Row className="mb-2">
                       <Col sm={4} className="fw-bold">Degree Program:</Col>
                       <Col sm={8}>{user?.degreeProgram|| 'N/A'}</Col>
                    </Row>
                    <Row className="mb-2">
                       <Col sm={4} className="fw-bold">Faculty:</Col>
                       <Col sm={8}>{user?.faculty || 'N/A'}</Col>
                    </Row>
                    
                    <div className="mt-4">
                        <Button variant="outline-primary" onClick={() => {
                            setPassMsg('');
                            setPassError('');
                            setOldPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                            setShowPasswordModal(true);
                        }}>
                             <i className="bi bi-key-fill me-2"></i>Change Password
                        </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab>
        </Tabs>
      )}

      {/* Change Password Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)} centered>
        <Modal.Header closeButton>
            <Modal.Title>Change Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {passError && <Alert variant="danger">{passError}</Alert>}
            {passMsg && <Alert variant="success">{passMsg}</Alert>}
            <Form onSubmit={handleChangePassword}>
                <Form.Group className="mb-3">
                <Form.Label>Old Password</Form.Label>
                <Form.Control 
                    type="password" 
                    required 
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                />
                </Form.Group>
                <Form.Group className="mb-3">
                <Form.Label>New Password</Form.Label>
                <Form.Control 
                    type="password" 
                    required 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                />
                </Form.Group>
                <Form.Group className="mb-3">
                <Form.Label>Confirm New Password</Form.Label>
                <Form.Control 
                    type="password" 
                    required 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                />
                </Form.Group>
                <div className="d-flex justify-content-end">
                    <Button variant="secondary" className="me-2" onClick={() => setShowPasswordModal(false)} disabled={isUpdatingPassword}>Cancel</Button>
                    <Button variant="warning" type="submit" disabled={isUpdatingPassword}>
                        {isUpdatingPassword ? (
                            <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> Updating...</>
                        ) : 'Update Password'}
                    </Button>
                </div>
            </Form>
        </Modal.Body>
      </Modal>

      {/* Enrollment Key Modal */}
      <Modal show={showEnrollModal} onHide={() => setShowEnrollModal(false)} centered>
        <Modal.Header closeButton>
            <Modal.Title>Enter Enrollment Key</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {enrollError && <Alert variant="danger">{enrollError}</Alert>}
            <p>The course <strong>{selectedCourse?.name}</strong> requires an enrollment key.</p>
            <Form.Group>
                <Form.Label>Enrollment Key</Form.Label>
                <Form.Control 
                    type="password" 
                    placeholder="Enter key" 
                    value={enrollmentKey} 
                    onChange={(e) => setEnrollmentKey(e.target.value)}
                />
            </Form.Group>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEnrollModal(false)} disabled={isEnrolling}>Cancel</Button>
            <Button variant="primary" onClick={() => selectedCourse && submitEnrollment(selectedCourse.id, enrollmentKey)} disabled={isEnrolling}>
                {isEnrolling ? (
                    <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> Enrolling...</>
                ) : 'Enroll'}
            </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

const CourseCard = ({ 
  course, 
  isEnrolled, 
  onArchive, 
  onUnarchive, 
  onEnrollClick 
}: { 
  course: Course, 
  isEnrolled: boolean, 
  onArchive: () => void, 
  onUnarchive: () => void, 
  onEnrollClick: () => void 
}) => {
  return (
    <Col md={4} lg={3} className="mb-4">
      <Card className="course-card h-100">
        <Card.Body className="d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <Badge bg="primary" className="p-2">{course.code}</Badge>
            <div className="d-flex align-items-center gap-2">
                {isEnrolled ? <Badge bg="success">Enrolled</Badge> : <Badge bg="secondary">Not Enrolled</Badge>}
                {isEnrolled && (
                    <Dropdown align="end">
                        <Dropdown.Toggle variant="link" bsPrefix="p-0" style={{ color: 'black', textDecoration: 'none' }}>
                            <i className="bi bi-three-dots-vertical" style={{ color: 'black' }}></i>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            {!course.isArchived ? (
                                <Dropdown.Item onClick={onArchive}>Archive</Dropdown.Item>
                            ) : (
                                <Dropdown.Item onClick={onUnarchive}>Unarchive</Dropdown.Item>
                            )}
                        </Dropdown.Menu>
                    </Dropdown>
                )}
            </div>
          </div>
          <Card.Title className="mt-2 text-truncate" title={course.name}>{course.name}</Card.Title>
          <Card.Subtitle className="mb-2 text-muted small">
               <i className="bi bi-person-fill me-1"></i>
               {course.teacherName}
          </Card.Subtitle>
          {course.academicYear && course.semester && (
              <div className="mb-3 small text-dark">
                  <i className="bi bi-calendar-event me-1"></i>
                  {course.academicYear} - {course.semester}
              </div>
          )}
          <Card.Text className="text-muted flex-grow-1">
            Explore the content of {course.name}.
          </Card.Text>
          <div className="mt-3">
            {!isEnrolled ? (
              <Button variant="primary" className="w-100" onClick={onEnrollClick}>
                Enroll Now
              </Button>
            ) : (
              <Button variant="success" className="w-100" as={Link as any} to={`/student/course/${course.id}`}>
                Go to Course
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
};

export default StudentDashboard;
