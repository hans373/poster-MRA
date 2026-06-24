const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Log EVERYTHING in plain text
app.use((req, res, next) => {
    console.log('\n' + '='.repeat(60));
    console.log(`📥 ${req.method} request to ${req.url}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
    console.log('='.repeat(60) + '\n');
    next();
});

// WEBHOOK ENDPOINT - Simple and clear
app.post('/webhook', (req, res) => {
    console.log('\n' + '🔥'.repeat(30));
    console.log('🔥🔥🔥 WEBHOOK RECEIVED FROM POSTER! 🔥🔥🔥');
    console.log('🔥'.repeat(30) + '\n');
    
    // Display the raw data
    console.log('📦 RAW DATA RECEIVED:');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('\n');
    
    // Display key fields if they exist
    console.log('📌 KEY FIELDS:');
    console.log(`   Object: ${req.body.object || req.body.objet || 'NOT FOUND'}`);
    console.log(`   Action: ${req.body.action || 'NOT FOUND'}`);
    console.log(`   Account: ${req.body.account || req.body.compte || 'NOT FOUND'}`);
    console.log(`   Object ID: ${req.body.object_id || req.body.id_objet || 'NOT FOUND'}`);
    console.log(`   Time: ${req.body.time || req.body.temps || 'NOT FOUND'}`);
    console.log(`   Verify: ${req.body.verify || req.body.vérifier || 'NOT FOUND'}`);
    
    if (req.body.data) {
        console.log(`   Data:`, JSON.stringify(req.body.data, null, 2));
    }
    if (req.body.données) {
        console.log(`   Data (French):`, JSON.stringify(req.body.données, null, 2));
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Always respond with 200 OK
    res.status(200).json({
        status: 'accepted',
        message: 'Webhook received successfully',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString() 
    });
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('✅ Server running on port', PORT);
    console.log('📍 Webhook URL: https://poster-mra.onrender.com/webhook');
    console.log('📍 Health: https://poster-mra.onrender.com/health');
    console.log('='.repeat(60));
    console.log('\n⏳ Waiting for webhooks...\n');
});
