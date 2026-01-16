import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Import routes only
import authRoutes from '../backend/src/routes/auth';
import userRoutes from '../backend/src/routes/users';
import ticketRoutes from '../backend/src/routes/tickets';
import settingsRoutes from '../backend/src/routes/settings';
import officeRoutes from '../backend/src/routes/offices';
import departmentRoutes from '../backend/src/routes/departments';
import emailRoutes from '../backend/src/routes/email';
import inventoryRoutes from '../backend/src/routes/inventory';
import uploadRoutes from '../backend/src/routes/upload';

const app = express();

// Minimal middleware for serverless
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/offices', officeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/upload', uploadRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;

