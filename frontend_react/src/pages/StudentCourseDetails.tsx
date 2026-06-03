import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Badge, Spinner, Alert, Tabs, Tab, Button, Row, Col, Modal } from 'react-bootstrap';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

// Interfaces
interface Session {
    id: string;
    courseId: string;
    teacherId: string;
    title: string;
    startTime: string;
    endTime: string;
    boundary: { lat: number; lng: number }[];
    status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';
}

interface Course {
    id: string;
    name: string;
    code: string;
    teacherName: string;
}

const Countdown = ({ targetDate, onComplete }: { targetDate: string, onComplete?: () => void }) => {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        const tick = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const diff = target - now;
            const FIVE_MINUTES = 5 * 60 * 1000;

            if (diff > FIVE_MINUTES) {
                setTimeLeft(null); // Hide if more than 5 mins away
            } else if (diff <= 0) {
                setTimeLeft("Starting soon...");
                // Allow a small buffer to trigger refresh once
                if (onComplete && diff > -2000) onComplete();
            } else {
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${minutes}m ${seconds}s`);
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [targetDate, onComplete]);

    if (!timeLeft) return null;

    return <div className="text-danger fw-bold">Starts in: {timeLeft}</div>;
};

const StudentCourseDetails: React.FC = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const user = useContext(AuthContext)?.user;
    
    const [course, setCourse] = useState<Course | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [markedSessionIds, setMarkedSessionIds] = useState<string[]>([]);
    const [markingSessionId, setMarkingSessionId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [markingStep, setMarkingStep] = useState<'GETTING_LOCATION' | 'MARKING' | 'SUCCESS' | 'ERROR' | null>(null);
    const [modalMsg, setModalMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [showUnenrollModal, setShowUnenrollModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
    // System Settings
    const [attendanceThreshold, setAttendanceThreshold] = useState(80);

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistorySession, setSelectedHistorySession] = useState<Session | null>(null);

    // Attendance Status Map: sessionId -> { count, required, completed, nextCheckIn, logs }
    interface AttendanceStatus {
        checkInCount: number;
        requiredCheckIns: number;
        lastCheckIn: string | null;
        completed: boolean;
        nextAllowedCheckIn: string | null;
        checkInLogs: string[];
    }
    const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

    const fetchData = async () => {
        setLoading(sessions.length === 0);
        try {
            // Fetch System Settings
            api.get('/api/system/general').then(res => {
                if (res.data.attendanceThreshold) setAttendanceThreshold(res.data.attendanceThreshold);
            }).catch(console.error);

            if (!course) {
                const courseRes = await api.get(`/api/courses/${courseId}`);
                setCourse(courseRes.data);
            }
            const sessionRes = await api.get(`/api/sessions/course/${courseId}`);
            setSessions(sessionRes.data);

            // Fetch Status
            try {
                const statusRes = await api.get('/api/attendance/student/status');
                const statusMap: Record<string, AttendanceStatus> = {};
                const markedIds: string[] = [];

                statusRes.data.forEach((s: any) => {
                    statusMap[s.sessionId] = {
                        checkInCount: s.checkInCount,
                        requiredCheckIns: s.requiredCheckIns,
                        lastCheckIn: s.lastCheckIn,
                        completed: s.completed,
                        nextAllowedCheckIn: s.nextAllowedCheckIn,
                        checkInLogs: s.checkInLogs || []
                    };
                    if (s.completed) markedIds.push(s.sessionId);
                });
                
                setAttendanceMap(statusMap);
                setMarkedSessionIds(markedIds);
            } catch (ignored) {
                // Fallback if endpoint fails
                const markedRes = await api.get('/api/attendance/student/marked');
                setMarkedSessionIds(markedRes.data);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load course data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (courseId) fetchData();
    }, [courseId]);

    const handleUnenroll = async () => {
        try {
            await api.delete(`/api/courses/${courseId}/unenroll/${user?.id}`);
            setShowUnenrollModal(false);
            setShowSuccessModal(true);
        } catch (err: any) {
            console.error(err);
            setError("Failed to unenroll.");
            setShowUnenrollModal(false);
        }
    };

    const handleHistoryClick = (session: Session) => {
        setSelectedHistorySession(session);
        setShowHistoryModal(true);
    };

    const markAttendance = async (sessionId: string) => {
        setMsg('');
        setError('');
        setMarkingSessionId(sessionId);
        setShowModal(true);
        setMarkingStep('GETTING_LOCATION');
        setModalMsg('Getting your location...');
        
        if (!navigator.geolocation) {
            setMarkingStep('ERROR');
            setModalMsg("Geolocation is not supported by your browser.");
            setMarkingSessionId(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                setMarkingStep('MARKING');
                setModalMsg('Submitting your attendance...');
                try {
                    const { latitude, longitude } = position.coords;
                    const deviceToken = localStorage.getItem('device_token');
                    
                    await api.post('/api/sessions/mark', {
                        sessionId,
                        lat: latitude,
                        lng: longitude,
                        deviceToken: deviceToken || ""
                    });
                    setMarkingStep('SUCCESS');
                    setModalMsg("Attendance Marked Successfully!");
                    fetchData(); // Refresh marked status
                } catch (err: any) {
                    console.error(err);
                    setMarkingStep('ERROR');
                    setModalMsg(err.response?.data?.message || "Failed to mark attendance.");
                } finally {
                    setMarkingSessionId(null);
                }
            },
            (err) => {
                console.error(err);
                setMarkingStep('ERROR');
                setModalMsg("Unable to retrieve location. Please allow location access.");
                setMarkingSessionId(null);
            }
        );
    };

    const categorizeSessions = (status: string) => 
        sessions
            .filter(s => s.status === status)
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    const getButtonLabel = (session: Session) => {
        if (markingSessionId === session.id) return 'Marking...';
        const stat = attendanceMap[session.id];
        if (!stat) return 'Mark Attendance';
        return `Mark Check-in (${stat.checkInCount + 1}/${stat.requiredCheckIns})`;
    };

    if (loading) return <Container className="mt-5 text-center"><Spinner animation="border" /></Container>;
    if (!course) return <Container className="mt-5"><Alert variant="danger">Course not found</Alert></Container>;

    return (
        <Container className="mt-5">
            <Button variant="outline-secondary" className="mb-3" onClick={() => navigate('/student-dashboard')}>
                &larr; Back to Dashboard
            </Button>
            
            <Card className="mb-4 shadow-sm border-0">
                <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                           <h3>{course.name} <Badge bg="info">{course.code}</Badge></h3>
                           <p className="text-muted mb-0">Teacher: {course.teacherName}</p>
                        </div>
                        <Button variant="danger" onClick={() => setShowUnenrollModal(true)}>Unenroll</Button>
                    </div>
                </Card.Body>
            </Card>

            {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
            {msg && <Alert variant="success" dismissible onClose={() => setMsg('')}>{msg}</Alert>}

            {/* Statistics Section */}
            {!loading && (
                <div className="mb-4">
                    <h4 className="mb-3">Attendance Overview</h4>
                    <Row className="g-3">
                        {/* Percentage Card */}
                        <Col md={3}>
                            <Card className={`h-100 text-center shadow-sm border-0 text-white ${
                                (() => {
                                    const pastSessions = sessions.filter(s => s.status === 'EXPIRED');
                                    const presentCount = pastSessions.filter(s => markedSessionIds.includes(s.id)).length;
                                    const total = pastSessions.length;
                                    const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;
                                    return rate < attendanceThreshold ? 'bg-danger' : 'bg-primary';
                                })()
                            }`}>
                                <Card.Body className="d-flex flex-column justify-content-center align-items-center">
                                    <h6 className="opacity-75">Attendance Rate</h6>
                                    <h1 className="display-4 fw-bold mb-0">
                                        {(() => {
                                            const pastSessions = sessions.filter(s => s.status === 'EXPIRED');
                                            const presentCount = pastSessions.filter(s => markedSessionIds.includes(s.id)).length;
                                            const total = pastSessions.length;
                                            return total > 0 ? Math.round((presentCount / total) * 100) : 0;
                                        })()}%
                                    </h1>
                                    {(() => {
                                         const pastSessions = sessions.filter(s => s.status === 'EXPIRED');
                                         const presentCount = pastSessions.filter(s => markedSessionIds.includes(s.id)).length;
                                         const total = pastSessions.length;
                                         const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;
                                         if (rate < attendanceThreshold) {
                                             return <small className="mt-2 fw-bold"><i className="bi bi-exclamation-triangle-fill"></i> Below Threshold ({attendanceThreshold}%)</small>;
                                         }
                                         return null;
                                    })()}
                                </Card.Body>
                            </Card>
                        </Col>
                        
                        {/* Stats Grid */}
                        <Col md={9}>
                            <Row className="g-3 h-100">
                                <Col sm={4}>
                                    <Card className="h-100 shadow-sm border-0 border-start border-success border-4">
                                        <Card.Body>
                                            <div className="text-secondary small mb-1">Present Sessions</div>
                                            <h3 className="fw-bold text-success mb-0">
                                                {sessions.filter(s => s.status === 'EXPIRED' && markedSessionIds.includes(s.id)).length}
                                            </h3>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col sm={4}>
                                    <Card className="h-100 shadow-sm border-0 border-start border-danger border-4">
                                        <Card.Body>
                                            <div className="text-secondary small mb-1">Absent Sessions</div>
                                            <h3 className="fw-bold text-danger mb-0">
                                                {(() => {
                                                    const pastSessions = sessions.filter(s => s.status === 'EXPIRED');
                                                    const presentCount = pastSessions.filter(s => markedSessionIds.includes(s.id)).length;
                                                    return pastSessions.length - presentCount;
                                                })()}
                                            </h3>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col sm={4}>
                                    <Card className="h-100 shadow-sm border-0 border-start border-info border-4">
                                        <Card.Body>
                                            <div className="text-secondary small mb-1">Total Sessions</div>
                                            <h3 className="fw-bold text-dark mb-0">
                                                {sessions.filter(s => s.status === 'EXPIRED').length}
                                            </h3>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col sm={12}>
                                    <Card className="h-100 shadow-sm border-0">
                                        <Card.Body className="d-flex align-items-center justify-content-between">
                                            <div>
                                                <div className="text-secondary small">Last Marked Date</div>
                                                <div className="fw-bold">
                                                    {(() => {
                                                        const markedSessions = sessions
                                                            .filter(s => markedSessionIds.includes(s.id))
                                                            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
                                                        return markedSessions.length > 0 
                                                            ? new Date(markedSessions[0].startTime).toLocaleDateString() + " " + new Date(markedSessions[0].startTime).toLocaleTimeString()
                                                            : "N/A";
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="text-success bg-success bg-opacity-10 p-2 rounded-circle">
                                                <i className="bi bi-calendar-check fs-4"></i>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                </div>
            )}

            <h4 className="mb-3">Sessions Details</h4>
            <Tabs defaultActiveKey="active" className="mb-3">
                <Tab eventKey="active" title={`Active (${categorizeSessions('ACTIVE').length})`}>
                    <Row className="g-3">
                        {categorizeSessions('ACTIVE').length === 0 && <Col><p className="text-muted">No active sessions.</p></Col>}
                        {categorizeSessions('ACTIVE').map(session => (
                            <Col md={6} key={session.id}>
                                <Card border="success">
                                    <Card.Body>
                                        <Card.Title>{session.title}</Card.Title>
                                        <Card.Text>
                                            <strong>Time:</strong> {new Date(session.startTime).toLocaleString()} - {new Date(session.endTime).toLocaleTimeString()}
                                        </Card.Text>
                                        {/* Show Status if partially marked */}
                                        {attendanceMap[session.id] && (
                                            <div className="mb-2">
                                                {!attendanceMap[session.id].completed && (
                                                    <div className="text-warning small mb-1">
                                                        <i className="bi bi-hourglass-split me-1"></i>
                                                        Check-in {attendanceMap[session.id].checkInCount} of {attendanceMap[session.id].requiredCheckIns} completed
                                                    </div>
                                                )}
                                                {/* Countdown to next check-in */}
                                                {attendanceMap[session.id].nextAllowedCheckIn && !attendanceMap[session.id].completed && (
                                                     <div className="mb-2">
                                                         <small className="text-muted d-block">Next check-in available in:</small>
                                                         <Countdown 
                                                            targetDate={attendanceMap[session.id].nextAllowedCheckIn!} 
                                                            onComplete={fetchData} 
                                                         />
                                                     </div>
                                                )}
                                                {/* Logs */}
                                                {attendanceMap[session.id].checkInLogs.length > 0 && (
                                                    <div className="mt-2 border-top pt-2">
                                                        <small className="text-muted fw-bold">Check-in Log:</small>
                                                        <ul className="list-unstyled small mb-0 ms-1 text-muted">
                                                            {attendanceMap[session.id].checkInLogs.map((log, idx) => (
                                                                <li key={idx}>
                                                                    <i className="bi bi-check-circle-fill text-success me-1"></i>
                                                                    {new Date(log).toLocaleTimeString()}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {attendanceMap[session.id]?.completed || markedSessionIds.includes(session.id) ? (
                                            <Button variant="secondary" disabled className="w-100">
                                                Marked <i className="bi bi-check-all ms-1"></i>
                                            </Button>
                                        ) : (
                                            <Button 
                                                variant={attendanceMap[session.id]?.checkInCount > 0 ? "warning" : "success"}
                                                onClick={() => markAttendance(session.id)}
                                                disabled={
                                                    markingSessionId === session.id || 
                                                    !!(attendanceMap[session.id]?.nextAllowedCheckIn && new Date() < new Date(attendanceMap[session.id].nextAllowedCheckIn!))
                                                }
                                                className="w-100"
                                            >
                                                {markingSessionId === session.id ? (
                                                    <>
                                                        <Spinner size="sm" className="me-2" /> Marking...
                                                    </>
                                                ) : (
                                                     attendanceMap[session.id]?.nextAllowedCheckIn && new Date() < new Date(attendanceMap[session.id].nextAllowedCheckIn!) 
                                                     ? "Wait for next slot..." 
                                                     : getButtonLabel(session)
                                                )}
                                            </Button>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Tab>
                <Tab eventKey="scheduled" title={`Scheduled (${categorizeSessions('SCHEDULED').length})`}>
                     <Row className="g-3">
                        {categorizeSessions('SCHEDULED').length === 0 && <Col><p className="text-muted">No scheduled sessions.</p></Col>}
                        {categorizeSessions('SCHEDULED').map(session => (
                            <Col md={6} key={session.id}>
                                <Card>
                                    <Card.Body>
                                        <Card.Title>{session.title}</Card.Title>
                                        <Card.Text>
                                            <strong>Starts:</strong> {new Date(session.startTime).toLocaleString()}
                                        </Card.Text>
                                        <div className="mb-2">
                                            <Countdown targetDate={session.startTime} onComplete={fetchData} />
                                        </div>
                                        <Badge bg="warning" text="dark">Scheduled</Badge>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Tab>
                <Tab eventKey="expired" title="History">
                    <Row className="g-3">
                        {categorizeSessions('EXPIRED').length === 0 && <Col><p className="text-muted">No past sessions.</p></Col>}
                         {categorizeSessions('EXPIRED').map(session => (
                            <Col md={6} key={session.id}>
                                <Card 
                                    className="bg-light text-muted h-100" 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleHistoryClick(session)}
                                >
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <Card.Title>{session.title}</Card.Title>
                                                <Card.Text>
                                                    Ended: {new Date(session.endTime).toLocaleString()}
                                                </Card.Text>
                                            </div>
                                            {markedSessionIds.includes(session.id) && (
                                                <i className="bi bi-check-circle-fill text-success" title="Attended"></i>
                                            )}
                                        </div>
                                        <Badge bg="secondary">Expired</Badge>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Tab>
            </Tabs>

            {/* Marking Attendance Modal */}
            <Modal show={showModal} onHide={() => {
                if (markingStep === 'SUCCESS' || markingStep === 'ERROR') {
                    setShowModal(false);
                    setTimeout(() => setMarkingStep(null), 300);
                }
            }} centered backdrop="static" keyboard={false}>
                <Modal.Header closeButton={markingStep === 'SUCCESS' || markingStep === 'ERROR'}>
                    <Modal.Title>Marking Attendance</Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center py-4">
                    {(markingStep === 'GETTING_LOCATION' || markingStep === 'MARKING') && (
                        <div className="mb-3">
                            <Spinner animation="border" variant="primary" />
                        </div>
                    )}
                    {markingStep === 'SUCCESS' && (
                        <div className="mb-3 text-success">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" className="bi bi-check-circle-fill" viewBox="0 0 16 16">
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                            </svg>
                        </div>
                    )}
                    {markingStep === 'ERROR' && (
                        <div className="mb-3 text-danger">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z"/>
                            </svg>
                        </div>
                    )}
                    <h5>{modalMsg}</h5>
                </Modal.Body>
                {(markingStep === 'SUCCESS' || markingStep === 'ERROR') && (
                    <Modal.Footer>
                        <Button variant="primary" onClick={() => {
                            setShowModal(false);
                            setTimeout(() => setMarkingStep(null), 300);
                        }}>
                            Close
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>

            {/* Unenroll Confirmation Modal */}
            <Modal show={showUnenrollModal} onHide={() => setShowUnenrollModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Unenrollment</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to unenroll from <strong>{course.name}</strong>?
                    <br />
                    <span className="text-danger small">You will lose access to all session history for this course.</span>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowUnenrollModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleUnenroll}>
                        Yes, Unenroll
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* History Status Modal */}
            <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Attendance Status</Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center">
                    {selectedHistorySession && (
                        <>
                            <h5 className="mb-3">{selectedHistorySession.title}</h5>
                            <p className="text-muted mb-4">
                                {new Date(selectedHistorySession.startTime).toLocaleString()}
                            </p>
                            
                            {markedSessionIds.includes(selectedHistorySession.id) ? (
                                <div className="text-success">
                                    <i className="bi bi-check-circle-fill" style={{ fontSize: '4rem' }}></i>
                                    <h4 className="mt-3">Present</h4>
                                    <p>You marked attendance for this session.</p>
                                </div>
                            ) : (
                                <div className="text-danger">
                                    <i className="bi bi-x-circle-fill" style={{ fontSize: '4rem' }}></i>
                                    <h4 className="mt-3">Absent</h4>
                                    <p>No attendance record found.</p>
                                </div>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                     <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Success Modal */}
            <Modal show={showSuccessModal} onHide={() => {}} centered backdrop="static" keyboard={false}>
                <Modal.Header>
                    <Modal.Title>Success</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center text-success mb-3">
                        <i className="bi bi-check-circle-fill" style={{ fontSize: '3rem' }}></i>
                    </div>
                    <p className="text-center">You have successfully unenrolled from <strong>{course.name}</strong>.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={() => {
                        setShowSuccessModal(false);
                        navigate('/student-dashboard');
                    }}>
                        OK
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default StudentCourseDetails;
