const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

const TICKETS_CSV = path.join(__dirname, 'tickets.csv');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
}

// Read CSV into array of objects
function readTickets() {
  if (!fs.existsSync(TICKETS_CSV)) return [];
  const data = fs.readFileSync(TICKETS_CSV, 'utf8');
  const lines = data.trim().split('\n');
  if (!lines.length) return [];
  const header = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] ? cols[i].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
    });
    return obj;
  });
}

// Write array of objects to CSV
function writeTickets(tickets) {
  if (!tickets.length) return;
  const header = Object.keys(tickets[0]);
  const lines = tickets.map(t =>
    header.map(h => csvEscape(t[h] ?? '')).join(',')
  );
  fs.writeFileSync(TICKETS_CSV, [header.join(','), ...lines].join('\n'), 'utf8');
}

// GET all tickets
router.get('/', (req, res) => {
  const tickets = readTickets();
  res.json(tickets);
});

// POST new ticket
router.post('/', (req, res) => {
  const body = req.body;
  const tickets = readTickets();
  const header = tickets[0] ? Object.keys(tickets[0]) : [
    'ticket_id','category','sub_category','opened','reported_by','contact_info',
    'priority','building','location','impacted','description','detectedBy','time_detected',
    'root_cause','actions_taken','status','assigned_to','resolution_summary','resolution_time',
    'duration','post_review','attachments','escalation_history','closed','sla_breach'
  ];

  // Handle file uploads
  let fileNames = [];
  if (req.files) {
    Object.values(req.files).forEach(file => {
      const targetPath = path.join(UPLOADS_DIR, file.name);
      fs.renameSync(file.path, targetPath);
      fileNames.push('/uploads/' + file.name);
    });
  }

  const newTicket = {};
  header.forEach(h => {
    if (h === 'building') {
      newTicket[h] = body[h] && typeof body[h] === 'object' ? body[h].value : body[h] ?? '';
    } else if (h === 'attachments') {
      newTicket[h] = fileNames.join(',');
    } else {
      newTicket[h] = body[h] ?? '';
    }
  });

  tickets.push(newTicket);
  writeTickets(tickets);
  res.json({ success: true, ticket: newTicket });
});

// PUT update ticket
router.put('/:ticket_id', (req, res) => {
  const body = req.body;
  const ticket_id = req.params.ticket_id;
  const tickets = readTickets();
  const ticketIndex = tickets.findIndex(t => t.ticket_id === ticket_id);

  if (ticketIndex === -1) return res.status(404).json({ error: 'Ticket not found' });

  const old = tickets[ticketIndex];

  // Merge body into old only if defined
  const newTicket = { ...old };
  Object.keys(body).forEach(k => {
    if (body[k] !== undefined) {
      if (k === 'building' && typeof body[k] === 'object') {
        newTicket[k] = body[k].value;
      } else {
        newTicket[k] = body[k];
      }
    }
  });

  // Handle attachments
  let fileNames = old.attachments ? old.attachments.split(',') : [];
  if (req.files) {
    Object.values(req.files).forEach(file => {
      const targetPath = path.join(UPLOADS_DIR, file.name);
      fs.renameSync(file.path, targetPath);
      fileNames.push('/uploads/' + file.name);
    });
  }
  newTicket.attachments = fileNames.join(',');

  tickets[ticketIndex] = newTicket;
  writeTickets(tickets);
  res.json({ success: true, ticket: newTicket });
});

module.exports = router;
