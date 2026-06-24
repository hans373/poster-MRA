const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// THIS IS CRITICAL: Parse JSON bodies
app.use(express.json());

// Log ALL requests for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} request to ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// SIMPLE WEBHOOK ENDPOINT - This is all you need to test
app.post('/webhook', (req, res) => {
    console.log('🔥 WEBHOOK RECEIVED!');
    console.log('📦 Data:', JSON.stringify(req.body, null, 2));
    
    // IMPORTANT: Poster expects a 200 OK response
    res.status(200).json({
        status: 'ok',
        received: true,
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Poster webhook handler is running',
        endpoints: {
            webhook: 'POST /webhook',
            health: 'GET /health'
        }
    });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Webhook URL: https://poster-mra.onrender.com/webhook`);
});
