// src/App.js
import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Card } from 'react-bootstrap';
import Select from 'react-select';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from "./LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import TicketsPage from './TicketsPage';
import { Alert } from 'react-bootstrap';

/**
 * axios instance that respects REACT_APP_API_URL.
 * - If REACT_APP_API_URL is set (e.g., in Docker/prod), it will use `${REACT_APP_API_URL}/api`.
 * - Otherwise (dev), it uses the CRA dev proxy `/api`.
 */
const API_BASE = (() => {
  const raw = process.env.REACT_APP_API_URL?.trim();
  if (raw && raw.length > 0) {
    // ensure no trailing slash, then append /api
    return `${raw.replace(/\/$/, '')}/api`;
  }
  // CRA dev proxy will forward /api to http://localhost:8000
  return '/api';
})();

const api = axios.create({
  baseURL: API_BASE,
});



// ---------- constants ----------
const subCategories = {
  Network: ["Router Failure","Switch Failure","Network Latency","Packet Loss","ISP Outage","Fiber Cut","DNS Issue","Bandwidth Saturation"],
  Server: ["CPU/Memory Overload","Hardware Fault","OS Crash"],
  Storage: ["Disk Failure","RAID Degraded","Capacity Alert"],
  Power: ["Power Outage","UPS Failure","Generator Issue"],
  Cooling: ["Cooling Unit Failure","Temperature Alert"],
  Security: ["Security Breach","Access Control Failure","Surveillance Offline"],
  "Access Control": ["Badge Reader Failure","Door Lock Failure"],
  Application: ["Software Bug","Service Crash","Performance Degradation"],
  Database: ["Database Error","Connection Timeout","Data Corruption"]
};
const categoryOptions = Object.keys(subCategories).map(cat => ({ value: cat, label: cat }));
const priorityOptions = [
  { value: "P0", label: "P0 - Catastrophic" },
  { value: "P1", label: "P1 - Critical" },
  { value: "P2", label: "P2 - High" },
  { value: "P3", label: "P3 - Medium" },
  { value: "P4", label: "P4 - Low" },
];
const buildingOptions = ["LOS1","LOS2","LOS3","LOS4","LOS5"].map(b => ({ value: b, label: b }));
const detectedByOptions = [
  { value: "", label: "-- Select --" },
  { value: "Monitoring Tool", label: "Monitoring Tool" },
  { value: "Customer Report", label: "Customer Report" },
  { value: "Engineer Observation", label: "Engineer Observation" },
  { value: "Automated Alert", label: "Automated Alert" },
  { value: "Other", label: "Other" },
];

const subOptionFromValue = (val) => (val ? { value: val, label: val } : null);
const toOption = (val) => (val ? { value: val, label: String(val) } : null);
const isoToLocalDatetime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ---------- App Component ----------
function App({ theme, setTheme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    category: null,
    sub_category: '',
    priority: null,
    building: '',
    location: '',
    impacted: '',
    description: '',
    detectedBy: null,
    detectedByOther: '',
    time_detected: '',
    root_cause: '',
    actions_taken: '',
  });

  const [alert, setAlert] = useState({ type: '', message: '' });
  const ticketToEdit = location?.state?.ticketToEdit ?? null;
  const isEditing = Boolean(ticketToEdit);

  useEffect(() => {
    if (isEditing) {
      const t = ticketToEdit;
      setForm({
        category: t.category ? toOption(t.category) : null,
        sub_category: t.sub_category ?? '',
        priority: t.priority ? toOption(t.priority) : null,
        building: t.building ?? '',
        location: t.location ?? '',
        impacted: t.impacted ?? '',
        description: t.description ?? '',
        detectedBy: t.detectedBy ? toOption(t.detectedBy) : null,
        detectedByOther: t.detectedByOther ?? '',
        time_detected:t.time_detected || '',
        root_cause: t.root_cause ?? '',
        actions_taken: t.actions_taken ?? '',
      });
    }
  }, [isEditing, ticketToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleCategoryChange = (selected) => setForm(f => ({ ...f, category: selected, sub_category: '' }));
  const handlePriorityChange = (selected) => setForm(f => ({ ...f, priority: selected }));
  const handleBuildingChange = (selected) => setForm(f => ({ ...f, building: selected ? selected.value : '' }));
  const handleDetectedByChange = (selected) => {
    setForm(f => ({ ...f, detectedBy: selected }));
    if (!selected || selected.value !== 'Other') setForm(f => ({ ...f, detectedByOther: '' }));
  };

  const getSubCategoryOptions = () => {
    const catKey = form.category?.value;
    if (!catKey) return [];
    return (subCategories[catKey] || []).map(s => ({ value: s, label: s }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const output = {
      category: form.category?.value || '',
      sub_category: form.sub_category,
      priority: form.priority?.value || '',
      building: form.building,
      location: form.location,
      impacted: form.impacted,
      description: form.description,
      detectedBy: form.detectedBy?.value || '',
      detectedByOther: form.detectedByOther,
      time_detected: form.time_detected || '',
      root_cause: form.root_cause,
      actions_taken: form.actions_taken,
    };
try {
  if (isEditing) {
    const identifier = ticketToEdit.id ?? ticketToEdit.ticket_id;
    await api.put(`/tickets/${identifier}`, output);
    setAlert({ type: 'success', message: 'Ticket updated successfully!' });
  } else {
    await api.post('/tickets', output, { headers: { 'Content-Type': 'application/json' } });
    setAlert({ type: 'success', message: 'Ticket created successfully!' });
  }
  navigate('/LoginPage');
} catch (err) {
  console.error('Error submitting ticket:', err);

  // Try to show backend error if available
  const backendMessage = err.response?.data?.message || err.message || 'Unknown error';

  setAlert({ type: 'danger', message: `Failed to submit ticket: ${backendMessage}` });
}

  };

  const textColor = theme === 'dark' ? '#fff' : '#000';
  const bgColor = theme === 'dark' ? '#121212' : '#ffffff';
  const cardBg = theme === 'dark' ? '#1e1e1e' : '#ffffff';
  const fieldBg = theme === 'dark' ? '#333' : '#fff';
  const borderColor = theme === 'dark' ? fieldBg : '#ccc';

return (
  <Container
    style={{
      maxWidth: 900,
      marginTop: 20,
      marginBottom: 40,
      backgroundColor: bgColor,
      minHeight: "100vh",
    }}
  >
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}
        className="btn btn-sm btn-outline-secondary"
        style={{ position: "absolute", right: 0, top: -10 }}
      >
        {theme === "light" ? "🌙 Dark" : "☀️ Light"}
      </button>


        <div className="text-center mb-4">
          <img src="/KasiLogo.jpeg" alt="Company Logo" style={{ maxWidth: 200 }} />
        </div>
       {/* ====== Page Title (Heading) ====== */}
{/* This is the main heading shown at the top of the form page. */}
<h2 className="text-center mb-4" style={{ color: textColor }}>
  Kasi Cloud Data Center Incident Ticket
</h2>

{/* ====== Success / Error Alert Section ====== */}
{/* This block conditionally displays an alert message if "alert.message" is set. 
    - `variant={alert.type}` controls whether it's success or danger.
    - `dismissible` allows the user to close it manually.
    - `onClose` clears the alert when the user clicks "X". */}
{alert.message && (
  <Alert
    variant={alert.type}
    onClose={() => setAlert({ type: '', message: '' })}
    dismissible
    className="mt-3"
  >
    {alert.message}
  </Alert>
)}

{/* ====== Ticket Form Start ====== */}
{/* The main form that handles creating a new ticket.
    The "onSubmit" triggers the handleSubmit() function. */}
<Form onSubmit={handleSubmit}>
          <Card className="p-3" style={{ border: `2px solid ${borderColor}`, backgroundColor: cardBg }}>

            {/* Square 1 */}
            <Card className="p-3 mb-3" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Category</Form.Label>
                    <Select classNamePrefix="rs" options={categoryOptions} value={form.category} onChange={handleCategoryChange} placeholder="-- Select Category --" isClearable />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Sub-category</Form.Label>
                    <Select classNamePrefix="rs" options={getSubCategoryOptions()} value={subOptionFromValue(form.sub_category)} onChange={(s) => setForm(f => ({ ...f, sub_category: s ? s.value : '' }))} placeholder="-- Select Sub-category --" isClearable isDisabled={!form.category} />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Priority Level</Form.Label>
                    <Select classNamePrefix="rs" options={priorityOptions} value={form.priority} onChange={handlePriorityChange} placeholder="-- Select Priority --" isClearable />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Building</Form.Label>
                    <Select classNamePrefix="rs" options={buildingOptions} value={form.building ? { value: form.building, label: form.building } : null} onChange={handleBuildingChange} placeholder="-- Select Building --" isClearable />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Affected Area</Form.Label>
                    <Form.Control type="text" name="location" value={form.location} onChange={handleChange} style={{ color: textColor, backgroundColor: fieldBg }} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Impacted Systems</Form.Label>
                    <Form.Control type="text" name="impacted" value={form.impacted} onChange={handleChange} style={{ color: textColor, backgroundColor: fieldBg }} />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group>
                <Form.Label style={{ color: textColor }}>Incident Description</Form.Label>
                <Form.Control as="textarea" rows={5} name="description" value={form.description} onChange={handleChange} style={{ color: textColor, backgroundColor: fieldBg }} />
              </Form.Group>
            </Card>

            {/* Square 2 */}
            <Card className="p-3" style={{ border: `2px solid ${borderColor}`, backgroundColor: cardBg }}>
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Detected By</Form.Label>
                    <Select classNamePrefix="rs" options={detectedByOptions} value={form.detectedBy} onChange={handleDetectedByChange} placeholder="-- Select --" isClearable />
                  </Form.Group>
                  {form.detectedBy?.value === 'Other' && (
                    <Form.Group className="mt-2">
                      <Form.Label style={{ color: textColor }}>Please specify</Form.Label>
                      <Form.Control type="text" name="detectedByOther" value={form.detectedByOther} onChange={handleChange} placeholder="Enter custom detection source" style={{ color: textColor, backgroundColor: fieldBg }} />
                    </Form.Group>
                  )}
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ color: textColor }}>Time Detected</Form.Label>
                    <Form.Control type="datetime-local" name="time_detected" value={form.time_detected} onChange={handleChange} style={{ color: textColor, backgroundColor: fieldBg }} />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mt-3">
                <Form.Label style={{ color: textColor }}>Root Cause</Form.Label>
                <Form.Control type="text" name="root_cause" value={form.root_cause} onChange={handleChange} style={{ color: textColor, backgroundColor: fieldBg }} />
              </Form.Group>

              <Form.Group className="mt-3">
                <Form.Label style={{ color: textColor }}>Action Taken</Form.Label>
                <Form.Control as="textarea" rows={3} name="actions_taken" value={form.actions_taken} onChange={handleChange} style={{ color: textColor, backgroundColor: fieldBg }} />
              </Form.Group>
            </Card>

            <div className="d-grid gap-2 mt-4">
              <Button type="submit" variant="primary" size="lg">{isEditing ? 'Update Ticket' : 'Create Ticket'}</Button>
            </div>
          </Card>
        </Form>
      </div>
    </Container>
  );
}

// ---------- App Router ----------
export default function AppRouter() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
<Router>
  <Routes>
    <Route path="/" element={<LoginPage />} />

    {/* Protect ticketspage */}
    <Route
      path="/ticketspage"
      element={
        <ProtectedRoute>
          <TicketsPage theme={theme} setTheme={setTheme} />
        </ProtectedRoute>
      }
    />

    <Route path="/frontend" element={<App theme={theme} setTheme={setTheme} />} />
    <Route path="*" element={<LoginPage />} />
  </Routes>
</Router>
  );
}

