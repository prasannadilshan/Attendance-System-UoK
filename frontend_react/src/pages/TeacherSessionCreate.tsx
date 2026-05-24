import React, { useState, useCallback, useRef } from 'react';
import { Container, Form, Button, Spinner, Row, Col, Modal } from 'react-bootstrap';
import { GoogleMap, useJsApiLoader, DrawingManager } from '@react-google-maps/api';
import api from '../api/axios';
import { useNavigate, useParams } from 'react-router-dom';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 7.2906, 
  lng: 80.6337
};

const TeacherSessionCreate: React.FC = () => {
    const { courseId } = useParams<{courseId: string}>();
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [weekly, setWeekly] = useState(false);
    const [recurrenceStartDate, setRecurrenceStartDate] = useState('');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
    
    // Check-in Config
    const [requiredCheckIns, setRequiredCheckIns] = useState('1');
    const [checkInIntervalMinutes, setCheckInIntervalMinutes] = useState('0');

    const [scheduledDates, setScheduledDates] = useState<string[]>([]);
    const [boundary, setBoundary] = useState<{lat: number, lng: number}[]>([]);

    // System Settings State
    const [defaultDuration, setDefaultDuration] = useState(60);

    // Fetch System Settings
    React.useEffect(() => {
        api.get('/api/system/general').then(res => {
            if (res.data.sessionDuration) {
                setDefaultDuration(res.data.sessionDuration);
            }
        }).catch(err => console.error("Failed to fetch system settings", err));
    }, []);

    // Effect to calculate scheduled dates
    React.useEffect(() => {
        if (weekly && startTime && recurrenceStartDate && recurrenceEndDate) {
            const dates: string[] = [];
            let current = new Date(recurrenceStartDate);
            // Ensure first session starts at correct time on the start date
            const startDateTime = new Date(startTime);
            current.setHours(startDateTime.getHours(), startDateTime.getMinutes());

            const end = new Date(recurrenceEndDate);
            end.setHours(23, 59, 59); // Include the end date fully

            while (current <= end) {
                dates.push(current.toISOString());
                current.setDate(current.getDate() + 7); // Add 7 days
            }
            setScheduledDates(dates);
        } else {
            setScheduledDates([]);
        }
    }, [weekly, startTime, recurrenceStartDate, recurrenceEndDate]);

    // Initialize recurrence start date and default end time when start time changes
    React.useEffect(() => {
        if (startTime) {
             // For simplicity, default recurrence start is the session start date
             setRecurrenceStartDate(startTime.split('T')[0]);
             
             // Auto-set End Time based on default duration if not set
             if (!endTime) {
                 const start = new Date(startTime);
                 const end = new Date(start.getTime() + defaultDuration * 60000);
                 // Format for datetime-local: YYYY-MM-DDTHH:mm
                 const endString = new Date(end.getTime() - (end.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                 setEndTime(endString);
             }
        }
    }, [startTime, defaultDuration]);
    
    // Map Center State
    const [mapCenter, setMapCenter] = useState(defaultCenter);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Saved Locations
    const [savedLocations, setSavedLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    
    // Modal State
    const [showAddLocationModal, setShowAddLocationModal] = useState(false);
    const [saveLocationName, setSaveLocationName] = useState('');
    const [modalBoundary, setModalBoundary] = useState<{lat: number, lng: number}[]>([]);

    React.useEffect(() => {
        api.get('/api/locations').then(res => {
            setSavedLocations(res.data);
        }).catch(err => console.error("Failed to fetch saved locations", err));
    }, []);

    const handleDeleteLocation = async () => {
        if (!selectedLocationId) return;
        if (!window.confirm("Are you sure you want to delete this location?")) return;
        
        try {
            await api.delete(`/api/locations/${selectedLocationId}`);
            setSavedLocations(savedLocations.filter(loc => loc.id !== selectedLocationId));
            setSelectedLocationId('');
            setBoundary([]);
            setSuccess("Location deleted successfully!");
            if (rectRef.current) {
                rectRef.current.setMap(null);
            }
        } catch (err: any) {
            console.error(err);
            setError("Failed to delete location.");
        }
    };
    
    const navigate = useNavigate();

    // Fetch user location on mount
    React.useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setMapCenter({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => {
                    console.error("Error getting location: ", err);
                    // Fallback to default center if location access denied/fails
                }
            );
        }
    }, []);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyA2eLFexIQfCqji9Tgrb73vKVJh0Fm_RXs",
        libraries: ['drawing', 'geometry']
    });

    const [map, setMap] = React.useState<any>(null);
    const rectRef = useRef<any>(null);

    const handleSelectLocation = (id: string, locations = savedLocations) => {
        setSelectedLocationId(id);
        const loc = locations.find(l => l.id === id);
        if (loc) {
            setBoundary(loc.boundary);
            if (loc.boundary && loc.boundary.length > 0) {
                setMapCenter({ lat: loc.boundary[0].lat, lng: loc.boundary[0].lng });
            }
            
            if (map && window.google) {
                if (rectRef.current) {
                    rectRef.current.setMap(null);
                }
                const polygon = new window.google.maps.Polygon({
                    paths: loc.boundary,
                    editable: false,
                    draggable: false,
                    fillColor: '#0d6efd',
                    fillOpacity: 0.35,
                    strokeColor: '#0d6efd',
                    strokeWeight: 2,
                    map: map
                });
                
                rectRef.current = polygon;
                
                const bounds = new window.google.maps.LatLngBounds();
                loc.boundary.forEach((p: any) => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
                map.fitBounds(bounds);
            }
        } else {
            setBoundary([]);
            if (rectRef.current) {
                rectRef.current.setMap(null);
            }
        }
    };

    const handleSaveLocation = async () => {
        if (modalBoundary.length !== 4) {
            setError("Please draw an area on the map first.");
            return;
        }
        if (!saveLocationName) {
            setError("Please provide a name for the location.");
            return;
        }
        try {
            const res = await api.post('/api/locations/create', {
                name: saveLocationName,
                boundary: modalBoundary
            });
            const newLocations = [...savedLocations, res.data];
            setSavedLocations(newLocations);
            setSuccess("Location saved successfully!");
            setSaveLocationName('');
            setModalBoundary([]);
            setShowAddLocationModal(false);
            
            handleSelectLocation(res.data.id, newLocations);
        } catch (err: any) {
            console.error(err);
            setError("Failed to save location.");
        }
    };

    const onLoad = useCallback(function callback(map: any) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback() {
        setMap(null);
    }, []);

    const onModalRectangleComplete = (rect: any) => {
        const bounds = rect.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        const corners = [
            { lat: ne.lat(), lng: ne.lng() }, 
            { lat: sw.lat(), lng: ne.lng() }, 
            { lat: sw.lat(), lng: sw.lng() }, 
            { lat: ne.lat(), lng: sw.lng() }  
        ];
        
        setModalBoundary(corners);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (boundary.length !== 4) {
            setError("Please select a valid location for the session.");
            return;
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

        if (parseInt(checkInIntervalMinutes) >= durationMinutes) {
            setError(`Check-in interval must be less than the session duration (${durationMinutes} minutes).`);
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/sessions/create', {
                courseId, 
                title,
                startTime,
                endTime,
                weekly,
                recurrenceEndDate: weekly && recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null,
                requiredCheckIns: parseInt(requiredCheckIns),
                checkInIntervalMinutes: parseInt(checkInIntervalMinutes),
                boundary
            });
            setSuccess("Session created successfully!");
            // Redirect back to course details
            setTimeout(() => navigate(`/teacher/course/${courseId}`), 2000);
        } catch (err: any) {
            console.error(err);
            setError("Failed to create session.");
        } finally {
            setLoading(false);
        }
    };

  return isLoaded ? (
      <Container className="mt-4">
          <h2>Create Session</h2>
          <Modal show={!!success} onHide={() => setSuccess('')} centered>
              <Modal.Header closeButton>
                  <Modal.Title className="text-success">Success</Modal.Title>
              </Modal.Header>
              <Modal.Body>{success}</Modal.Body>
              <Modal.Footer>
                  <Button variant="success" onClick={() => setSuccess('')}>
                      OK
                  </Button>
              </Modal.Footer>
          </Modal>

          <Modal show={!!error} onHide={() => setError('')} centered>
              <Modal.Header closeButton>
                  <Modal.Title className="text-danger">Error</Modal.Title>
              </Modal.Header>
              <Modal.Body>{error}</Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" onClick={() => setError('')}>
                      Close
                  </Button>
              </Modal.Footer>
          </Modal>

          <Modal show={showAddLocationModal} onHide={() => setShowAddLocationModal(false)} size="lg" centered>
              <Modal.Header closeButton>
                  <Modal.Title>Add New Location</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                  <Form.Group className="mb-3">
                      <Form.Label>Location Name</Form.Label>
                      <Form.Control 
                          type="text" 
                          placeholder="e.g. Science Lab 1" 
                          value={saveLocationName}
                          onChange={(e) => setSaveLocationName(e.target.value)}
                      />
                  </Form.Group>
                  <Form.Group className="mb-3">
                      <Form.Label>Draw Area (Rectangle)</Form.Label>
                      <div className="border p-1 rounded">
                          <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '350px' }}
                            center={mapCenter}
                            zoom={15}
                          >
                             <DrawingManager
                                onRectangleComplete={onModalRectangleComplete}
                                options={{
                                    drawingControl: true,
                                    drawingControlOptions: {
                                        drawingModes: ['rectangle' as any],
                                        position: window.google?.maps?.ControlPosition?.TOP_CENTER
                                    },
                                    rectangleOptions: {
                                        editable: true,
                                        draggable: true
                                    }
                                }}
                             />
                          </GoogleMap>
                      </div>
                      <Form.Text className="text-muted mt-1">Draw a square/rectangle shape to define the boundaries.</Form.Text>
                  </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" onClick={() => setShowAddLocationModal(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handleSaveLocation}>Save Location</Button>
              </Modal.Footer>
          </Modal>
          
          <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                  <Form.Label>Session Title</Form.Label>
                  <Form.Control type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Form.Group>
            
              <Form.Group className="mb-3">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </Form.Group>

              <Form.Group className="mb-3">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </Form.Group>

              <Form.Group className="mb-3">
                  <Form.Check 
                      type="checkbox" 
                      label="Weekly Schedule?" 
                      checked={weekly} 
                      onChange={(e) => setWeekly(e.target.checked)} 
                  />
              </Form.Group>

              {weekly && (
                  <div className="mb-4 ps-3 border-start border-primary">
                      <Form.Group className="mb-3">
                          <Form.Label>Recurrence Start Date</Form.Label>
                          <Form.Control 
                              type="date" 
                              value={recurrenceStartDate} 
                              onChange={(e) => setRecurrenceStartDate(e.target.value)} 
                              min={startTime ? startTime.split('T')[0] : ''}
                              required 
                          />
                          <Form.Text className="text-muted">Sessions will be scheduled weekly starting from this date.</Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                          <Form.Label>Recurrence End Date</Form.Label>
                          <Form.Control 
                              type="date" 
                              value={recurrenceEndDate} 
                              onChange={(e) => setRecurrenceEndDate(e.target.value)} 
                              min={recurrenceStartDate || (startTime ? startTime.split('T')[0] : '')}
                              required 
                          />
                      </Form.Group>

                      {scheduledDates.length > 0 && (
                          <div className="mb-3">
                              <strong>Scheduled Dates Preview ({scheduledDates.length} sessions):</strong>
                              <ul className="mt-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                  {scheduledDates.map((date, idx) => (
                                      <li key={idx}>{new Date(date).toDateString()}</li>
                                  ))}
                              </ul>
                          </div>
                      )}
                  </div>
              )}
              
              <Row>
                  <Col md={6}>
                      <Form.Group className="mb-3">
                          <Form.Label>Required Check-ins</Form.Label>
                          <Form.Control 
                              type="number" 
                              min="1" 
                              value={requiredCheckIns} 
                              onChange={(e) => setRequiredCheckIns(e.target.value)} 
                          />
                          <Form.Text className="text-muted">
                              Number of times a student must mark attendance.
                          </Form.Text>
                      </Form.Group>
                  </Col>
                  <Col md={6}>
                      <Form.Group className="mb-3">
                          <Form.Label>Check-in Interval (Minutes)</Form.Label>
                          <Form.Control 
                              type="number" 
                              min="0" 
                              value={checkInIntervalMinutes} 
                              onChange={(e) => setCheckInIntervalMinutes(e.target.value)} 
                          />
                          <Form.Text className="text-muted">
                              Minimum wait time between check-ins.
                          </Form.Text>
                      </Form.Group>
                  </Col>
              </Row>

              <Form.Group className="mb-3">
                  <Form.Label>Classroom Location Area</Form.Label>
                  <Row className="mb-2">
                      <Col md={7}>
                          <Form.Select 
                              value={selectedLocationId} 
                              onChange={(e) => handleSelectLocation(e.target.value)}
                          >
                              <option value="">-- Select a Saved Location --</option>
                              {savedLocations.map(loc => (
                                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                              ))}
                          </Form.Select>
                      </Col>
                      <Col md={5} className="d-flex gap-2">
                          <Button variant="primary" onClick={() => setShowAddLocationModal(true)}>+ Add Location</Button>
                          {selectedLocationId && (
                              <Button variant="danger" onClick={handleDeleteLocation}>Delete</Button>
                          )}
                      </Col>
                  </Row>
                  <div className="border rounded p-1 mb-2">
                      <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={mapCenter}
                        zoom={15}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                      >
                         {/* Location preview shown here via Polygon drawn dynamically */}
                      </GoogleMap>
                  </div>
                  {!selectedLocationId && (
                      <Form.Text className="text-danger">Please select a location for the session.</Form.Text>
                  )}
              </Form.Group>

              <Button type="submit" disabled={loading}>
                  {loading ? <Spinner size="sm" animation="border"/> : "Create Session"}
              </Button>
          </Form>
      </Container>
  ) : <Container><Spinner animation="border" /></Container>;
}

export default TeacherSessionCreate;
