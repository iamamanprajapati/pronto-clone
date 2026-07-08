import { createServer } from 'node:http';
import express from 'express';
import { config } from './config';
import { errorMiddleware } from './middleware/errors';
import { initGateway } from './realtime/gateway';
import { startSnapshotLoop } from './modules/location';
import { startJobWorkers } from './jobs/workers';

import { authRouter } from './modules/auth';
import { usersRouter } from './modules/users';
import { catalogRouter } from './modules/catalog';
import { bookingsRouter } from './modules/bookings';
import { dispatchRouter } from './modules/dispatch';
import { locationRouter } from './modules/location';
import { paymentsRouter } from './modules/payments';
import { earningsRouter } from './modules/earnings';
import { workforceRouter } from './modules/workforce';
import { safetyRouter } from './modules/safety';
import { supportRouter } from './modules/support';
import { adminRouter } from './modules/admin';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

app.use('/v1/auth', authRouter);
app.use('/v1/users', usersRouter);
app.use('/v1/catalog', catalogRouter);
app.use('/v1/bookings', bookingsRouter);
app.use('/v1/dispatch', dispatchRouter);
app.use('/v1/location', locationRouter);
app.use('/v1/payments', paymentsRouter);
app.use('/v1/earnings', earningsRouter);
app.use('/v1/workforce', workforceRouter);
app.use('/v1/safety', safetyRouter);
app.use('/v1/support', supportRouter);
app.use('/v1/admin', adminRouter);

app.use(errorMiddleware);

const http = createServer(app);
initGateway(http);
startJobWorkers();
startSnapshotLoop();

http.listen(config.port, () => {
  console.log(`Pronto API + realtime gateway on :${config.port}`);
});
