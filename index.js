const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Your application secret from Poster developer portal
const CLIENT_SECRET = '661636b73b1b34aaca2460034e55ebb1';

// Parse JSON bodies
app.use(express.json());

// Webhook endpoint for Poster
app.post('/webhook', async (req, res) => {
    console.log('📨 Webhook received at:', new Date().toISOString());
    console.log('📦 Webhook data:', JSON.stringify(req.body, null, 2));

    try {
        // 1. Verify the signature
        const webhookData = req.body;
        const verifyOriginal = webhookData.verify;
        delete webhookData.verify;

        // Reconstruct the verification string
        let verifyParts = [
            webhookData.account,
            webhookData.object,
            webhookData.object_id.toString(),
            webhookData.action
        ];

        if (webhookData.data) {
            verifyParts.push(JSON.stringify(webhookData.data));
        }

        verifyParts.push(webhookData.time);
        verifyParts.push(CLIENT_SECRET);

        const calculatedVerify = crypto
            .createHash('md5')
            .update(verifyParts.join(';'))
            .digest('hex');

        if (calculatedVerify !== verifyOriginal) {
            console.error('❌ Invalid signature!');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        console.log('✅ Signature verified successfully!');

        // 2. Process based on object type
        if (webhookData.object === 'transaction' && webhookData.action === 'added') {
            console.log('💰 New transaction detected!');
            console.log('📊 Transaction ID:', webhookData.object_id);
            
            // TODO: Add MRA API call here
            // await sendToMRA(webhookData);
        }

        // 3. Always respond with 200 OK
        res.status(200).json({ 
            status: 'accepted', 
            message: 'Webhook received successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString() 
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        service: 'Poster MRA Webhook Handler',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            webhook: 'POST /webhook',
            health: 'GET /health'
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Webhook endpoint: /webhook`);
    console.log(`❤️ Health check: /health`);
});
