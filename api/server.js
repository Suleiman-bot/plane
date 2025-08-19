// api/server.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import ticketsRouter from './routes/tickets.js';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/tickets', ticketsRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Plane backend running on port ${PORT}`));
