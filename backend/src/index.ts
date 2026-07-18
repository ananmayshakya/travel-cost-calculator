import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { vehiclesRouter } from './routes/vehicles.js';
import { calculateRouter } from './routes/calculate.js';
import { fuelRouter } from './routes/fuel.js';

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

// liveness check for the API
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', vehiclesRouter);
app.use('/api', calculateRouter);
app.use('/api', fuelRouter);

app.listen(port, () => {
  console.log(`backend listening on port ${port}`);
});
