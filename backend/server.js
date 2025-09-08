const express = require('express');
const urlRoutes = require('./routes/urlShortener');
const statsRoutes = require('./routes/stats');
const logging = require('./middleware/logging');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(logging.logAPICall());

// Routes
app.use('/shorturls', urlRoutes);
app.use('/shorturls', statsRoutes);

// Health check
app.get('/health', (req, res) => {
    logging.logInfo('Health check requested');
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test server connection on startup
async function startServer() {
    try {
        const connected = await logging.testServerConnection();
        console.log(`Test server connection: ${connected ? 'Success' : 'Failed'}`);
        
        app.listen(PORT, () => {
            logging.logInfo(`Server started on port ${PORT}`);
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

startServer();