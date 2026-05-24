import React, { useState, useEffect } from 'react';
import { Container, Tabs, Tab, Card, Button, Alert } from 'react-bootstrap';
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

    const markAttendance = async (sessionId: string) => {
        setMsg(null);
        setMarkingSessionId(sessionId);
        if (!navigator.geolocation) {
            setMsg({type: 'danger', text: 'Geolocation is not supported by your browser'});
            setMarkingSessionId(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                await api.post('/api/sessions/mark', {
                    sessionId,
                    lat: latitude,
                    lng: longitude
                });
                setMsg({type: 'success', text: 'Attendance Marked Successfully!'});
                // Disable button or refresh
            } catch (err: any) {
                setMsg({type: 'danger', text: err.response?.data?.message || 'Failed to mark attendance'});
            } finally {
                setMarkingSessionId(null);
            }
        }, () => {
            setMsg({type: 'danger', text: 'Unable to retrieve your location'});
            setMarkingSessionId(null);
        });
    };

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    const scheduledSessions = sessions.filter(s => s.status === 'SCHEDULED');
    const expiredSessions = sessions.filter(s => s.status === 'EXPIRED');

    const SessionCard = ({ session, showMark }: { session: any, showMark: boolean }) => (
        <Card className="mb-3">
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
            
            <Tabs defaultActiveKey="active" className="mb-3">
                <Tab eventKey="active" title={`Active (${activeSessions.length})`}>
                     {activeSessions.length === 0 && <p>No active sessions.</p>}
                     {activeSessions.map(s => <SessionCard key={s.id} session={s} showMark={true} />)}
                </Tab>
                <Tab eventKey="scheduled" title={`Scheduled (${scheduledSessions.length})`}>
                     {scheduledSessions.map(s => <SessionCard key={s.id} session={s} showMark={false} />)}
                </Tab>
                <Tab eventKey="expired" title="Expired/History">
                     {expiredSessions.map(s => <SessionCard key={s.id} session={s} showMark={false} />)}
                </Tab>
            </Tabs>
        </Container>
    );
}

export default StudentSessions;
