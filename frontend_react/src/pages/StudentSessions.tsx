import React, { useState, useEffect } from 'react';
import { Container, Tabs, Tab, Card, Button, Alert, Modal, Spinner } from 'react-bootstrap';
import api from '../api/axios';

const StudentSessions: React.FC = () => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [, setLoading] = useState(true);
    const [msg, setMsg] = useState<{type: string, text: string} | null>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/api/sessions/student');
            setSessions(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const [markingSessionId, setMarkingSessionId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [markingStep, setMarkingStep] = useState<'GETTING_LOCATION' | 'MARKING' | 'SUCCESS' | 'ERROR' | null>(null);
    const [modalMsg, setModalMsg] = useState('');

    const markAttendance = async (sessionId: string) => {
        setMsg(null);
        setMarkingSessionId(sessionId);
        setShowModal(true);
        setMarkingStep('GETTING_LOCATION');
        setModalMsg('Getting your location...');

        if (!navigator.geolocation) {
            setMarkingStep('ERROR');
            setModalMsg('Geolocation is not supported by your browser');
            setMarkingSessionId(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            setMarkingStep('MARKING');
            setModalMsg('Submitting your attendance...');
            try {
                await api.post('/api/sessions/mark', {
                    sessionId,
                    lat: latitude,
                    lng: longitude
                });
                setMarkingStep('SUCCESS');
                setModalMsg('Attendance Marked Successfully!');
            } catch (err: any) {
                setMarkingStep('ERROR');
                setModalMsg(err.response?.data?.message || 'Failed to mark attendance');
            } finally {
                setMarkingSessionId(null);
            }
        }, () => {
            setMarkingStep('ERROR');
            setModalMsg('Unable to retrieve your location. Please ensure location services are enabled.');
            setMarkingSessionId(null);
        });
    };

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    const scheduledSessions = sessions.filter(s => s.status === 'SCHEDULED');
    const expiredSessions = sessions.filter(s => s.status === 'EXPIRED');

    const renderSessionCard = (session: any, showMark: boolean) => (
        <Card className="mb-3" key={session.id}>
            <Card.Body>
                <Card.Title>{session.title}</Card.Title>
                <Card.Subtitle className="mb-2 text-muted">
                    {new Date(session.startTime).toLocaleString()} - {new Date(session.endTime).toLocaleString()}
                </Card.Subtitle>
                {showMark && (
                    <Button 
                        variant="success" 
                        onClick={() => markAttendance(session.id)}
                        disabled={markingSessionId === session.id}
                    >
                        {markingSessionId === session.id ? 'Marking...' : 'Mark Attendance'}
                    </Button>
                )}
            </Card.Body>
        </Card>
    );

    return (
        <Container className="mt-4">
            <h2>My Sessions</h2>
            {msg && <Alert variant={msg.type}>{msg.text}</Alert>}

            <Modal show={showModal} onHide={() => {
                if (markingStep === 'SUCCESS' || markingStep === 'ERROR') {
                    setShowModal(false);
                    setTimeout(() => setMarkingStep(null), 300); // clear after animation
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
            
            <Tabs defaultActiveKey="active" className="mb-3">
                <Tab eventKey="active" title={`Active (${activeSessions.length})`}>
                     {activeSessions.length === 0 && <p>No active sessions.</p>}
                     {activeSessions.map(s => renderSessionCard(s, true))}
                </Tab>
                <Tab eventKey="scheduled" title={`Scheduled (${scheduledSessions.length})`}>
                     {scheduledSessions.map(s => renderSessionCard(s, false))}
                </Tab>
                <Tab eventKey="expired" title="Expired/History">
                     {expiredSessions.map(s => renderSessionCard(s, false))}
                </Tab>
            </Tabs>
        </Container>
    );
}

export default StudentSessions;
