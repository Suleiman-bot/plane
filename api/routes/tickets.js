// api/routes/tickets.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const router = express.Router();
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.csv');
const HISTORY_FILE = path.join(DATA_DIR, 'ticket_history.csv');

// Ensure directories & files
[DATA_DIR, UPLOADS_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir));
if (!fs.existsSync(TICKETS_FILE)) {
  fs.writeFileSync(
    TICKETS_FILE,
    'ticket_id,category,sub_category,opened,reported_by,contact_info,priority,building,location,impacted,description,detectedBy,time_detected,root_cause,actions_taken,status,assigned_to,resolution_summary,resolution_time,duration,post_review,attachments,escalation_history,closed,sla_breach\n'
  );
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, 'ticket_id,timestamp,action,changes,editor\n');
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Helpers
const CATEGORY_SHORT = {
  'Network': 'NET',
  'Server': 'SER',
  'Storage': 'STOR',
  'Power': 'PWD',
  'Cooling': 'COOL',
  'Security': 'SEC',
  'Access Control': 'AC',
  'Application': 'APP',
  'Database': 'DBS'
};

const LOCATION_CODE = 'LOS5'; // <-- adjust if needed
const generateTicketId = (category) => {
  const short = CATEGORY_SHORT[category] || 'GEN';
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');

  // Count how many tickets exist for this category
  let count = 0;
  if (fs.existsSync(TICKETS_FILE)) {
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    if (lines.length > 1) {
      const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
      const catIndex = header.indexOf('category');
      if (catIndex !== -1) {
        lines.forEach(line => {
          const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
          const existingCat = cols[catIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"');
          if (existingCat === category) count++;
        });
      }
    }
  }

  const sequence = String(count + 1).padStart(4, '0');
  return `KASI-${LOCATION_CODE}-${yyyymmdd}-${short}-${sequence}`;
};

const csvEscape = val => `"${String(val || '').replace(/"/g, '""')}"`;
const parsePayload = req => {
  if (req.is('multipart/form-data') && req.body.payload) {
    try { return JSON.parse(req.body.payload); } catch { return req.body; }
  }
  return req.body;
};

// ✅ helper to convert attachments to URLs
const toAttachmentUrls = filenames =>
  filenames
    .split(';')
    .filter(f => f.trim())
    .map(f => `/uploads/${f}`);

// POST create ticket
router.post('/', upload.array('attachments[]'), (req, res) => {
  try {
    const body = parsePayload(req);
    const ticket_id = body.ticket_id || generateTicketId(body.category);
    const assigned_to = Array.isArray(body.assigned_to) ? body.assigned_to.join(';') : (body.assigned_to || '');
    const post_review = body.post_review ? 'Yes' : 'No';
    const sla_breach = body.sla_breach ? 'Yes' : 'No';
    const fileNames = (req.files || []).map(f => path.basename(f.filename)).join(';');

    const row = [
      ticket_id,
      body.category || '', body.sub_category || '', body.opened || '', body.reported_by || '', body.contact_info || '',
      body.priority || '', body.building || '', body.location || '', body.impacted || '', body.description || '', body.detectedBy || '',
      body.time_detected || '', body.root_cause || '', body.actions_taken || '', body.status || '', assigned_to,
      body.resolution_summary || '', body.resolution_time || '', body.duration || '', post_review,
      fileNames, body.escalation_history || '', body.closed || '', sla_breach
    ].map(csvEscape).join(',') + '\n';

    fs.appendFileSync(TICKETS_FILE, row);

    // history
    const historyLine = [
      ticket_id, new Date().toISOString(), 'create',
      JSON.stringify({ ...body, attachments: fileNames }),
      body.reported_by || ''
    ].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(HISTORY_FILE, historyLine);

    res.json({
      success: true,
      ticket_id,
      ...body,
      attachments: fileNames ? toAttachmentUrls(fileNames) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to save ticket' });
  }
});

// GET all tickets
router.get('/', (_, res) => {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return res.json([]);
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const tickets = lines.map(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const obj = {};
      header.forEach((h, i) => {
        let v = cols[i] || '';
        v = v.replace(/^"|"$/g, '').replace(/""/g, '"');
        obj[h] = v;
      });

      if (obj.attachments) {
        obj.attachments = toAttachmentUrls(obj.attachments);
      } else {
        obj.attachments = [];
      }

      return obj;
    });
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read tickets' });
  }
});

// GET ticket history
router.get('/:id/history', (req, res) => {
  const id = req.params.id;
  try {
    if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
    const lines = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    const entries = lines.map(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const obj = {};
      header.forEach((h, i) => { obj[h] = cols[i]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''; });
      return obj;
    }).filter(e => e.ticket_id === id);
    res.json(entries);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to read history' }); }
});

// PUT update ticket
router.put('/:id', upload.array('attachments[]'), (req, res) => {
  try {
    const id = req.params.id;
    const body = parsePayload(req);
    if (!fs.existsSync(TICKETS_FILE)) return res.status(404).json({ error: 'No tickets file' });
    const lines = fs.readFileSync(TICKETS_FILE, 'utf8').trim().split('\n');
    const header = lines.shift().split(',').map(h => h.replace(/"/g, ''));
    let found = false;
    let updatedTicket = null;

    const updatedLines = lines.map(line => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      if (cols[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') === id) {
        found = true;
        const old = {};
        header.forEach((h, i) => { old[h] = cols[i]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''; });
        const assigned_to = Array.isArray(body.assigned_to) ? body.assigned_to.join(';') : (body.assigned_to || old.assigned_to);
        const post_review = body.post_review !== undefined ? (body.post_review ? 'Yes' : 'No') : old.post_review;
        const sla_breach = body.sla_breach !== undefined ? (body.sla_breach ? 'Yes' : 'No') : old.sla_breach;
        const fileNames = ((req.files || []).map(f => path.basename(f.filename)).join(';')) || old.attachments;
        const newRowObj = { ...old, ...body, assigned_to, post_review, sla_breach, attachments: fileNames };
        updatedTicket = { ...newRowObj, attachments: fileNames ? toAttachmentUrls(fileNames) : [] };
        const row = header.map(h => csvEscape(newRowObj[h] || '')).join(',');
        return row;
      }
      return line;
    });

    if (!found) return res.status(404).json({ error: 'Ticket not found' });
    fs.writeFileSync(TICKETS_FILE, [header.map(csvEscape).join(',')].concat(updatedLines).join('\n') + '\n');
    const historyLine = [id, new Date().toISOString(), 'update', JSON.stringify(body), body.reported_by || ''].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(HISTORY_FILE, historyLine);

    res.json({ success: true, ticket_id: id, ...updatedTicket });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update ticket' }); }
});

export default router;
