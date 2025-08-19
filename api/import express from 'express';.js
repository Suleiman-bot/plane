import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import ticketsRouter from './routes/tickets.js';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());
app.use('/api/tickets', ticketsRouter);

app.listen(PORT, () => {
  console.log(`Plane backend running on port ${PORT}`);
});
er