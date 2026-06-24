const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// CONFIGURATION - YOUR TOKENS
// ================================================================
const POSTER_ACCESS_TOKEN = '197249:22124116c0cdc8ce54e90e7c085b51ae';
const CLIENT_SECRET = '661636b73b1b34aaca2460034e55ebb1';

// Parse JSON bodies
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log('\n' + '='.repeat(60));
    console.log(`📥 ${req.method} request to ${req.url}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
    console.log('='.repeat(60) + '\n');
    next();
});

// ================================================================
// WEBHOOK ENDPOINT
// ================================================================
app.post('/webhook', (req, res) => {
    console.log('\n' + '🔥'.repeat(30));
    console.log('🔥🔥🔥 WEBHOOK RECEIVED FROM POSTER! 🔥🔥🔥');
    console.log('🔥'.repeat(30) + '\n');
    
    console.log('📦 RAW DATA RECEIVED:');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('\n');
    
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

    // ============================================================
    // PROCESS ONLY THE "closed" ACTION
    // ============================================================
    if (req.body.action === 'closed' && req.body.object === 'transaction') {
        console.log('\n💰💰💰 SALE COMPLETED! Processing for MRA... 💰💰💰');
        
        let parsedData = null;
        if (req.body.data) {
            try {
                parsedData = JSON.parse(req.body.data);
                console.log('✅ Data parsed successfully!');
            } catch (e) {
                console.log('⚠️ Could not parse data field');
            }
        }
        
        const saleData = {
            account: req.body.account || '',
            account_number: req.body.account_number || '',
            transaction_id: req.body.object_id || 0,
            action: req.body.action || '',
            time: req.body.time || '',
            verify: req.body.verify || '',
            parsed_data: parsedData || null
        };
        
        if (parsedData && parsedData.transactions_history) {
            const history = parsedData.transactions_history;
            saleData.type_history = history.type_history || '';
            saleData.history_time = history.time || 0;
            saleData.value = history.value || 0;
            saleData.value2 = history.value2 || 0;
            saleData.value3 = history.value3 || 0;
            saleData.value4 = history.value4 || 0;
            saleData.value5 = history.value5 || null;
            saleData.value_text = history.value_text || '';
            saleData.user_id = history.user_id || 0;
            saleData.spot_tablet_id = history.spot_tablet_id || 0;
            
            if (history.value_text) {
                try {
                    const details = JSON.parse(history.value_text);
                    saleData.payment_details = details;
                    
                    if (details.payments) {
                        saleData.payment_method = Object.keys(details.payments)[0] || 'unknown';
                        saleData.total_amount = details.payments[saleData.payment_method] || 0;
                    }
                    
                    if (details.products) {
                        saleData.products = details.products;
                    }
                    
                } catch (e) {
                    console.log('⚠️ Could not parse value_text');
                }
            }
        }
        
        console.log('\n📊 COMPLETE SALE DATA EXTRACTED:');
        console.log(JSON.stringify(saleData, null, 2));
        
        // Send to MRA mock and print receipt
        sendToMraAndPrint(saleData);
    }
    
    // Always respond with 200 OK
    res.status(200).json({
        status: 'accepted',
        message: 'Webhook received successfully',
        timestamp: new Date().toISOString()
    });
});

// ================================================================
// MRA MOCK API
// ================================================================
app.post('/mra-mock', (req, res) => {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 MRA MOCK API CALLED!');
    
    const mraData = req.body;
    console.log('📦 Data received by mock:', JSON.stringify(mraData, null, 2));
    
    const fakeQR = `FAKE-QR-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const fakeInvoice = `INV-${String(mraData.transaction_id || 0).padStart(6, '0')}`;
    
    console.log('⏳ Processing...');
    
    const response = {
        success: true,
        qr_code: fakeQR,
        invoice_number: fakeInvoice,
        timestamp: new Date().toISOString(),
        message: 'Mock MRA response - QR code generated for testing'
    };
    
    console.log('✅ Mock response sent:', JSON.stringify(response, null, 2));
    console.log('='.repeat(60) + '\n');
    
    res.status(200).json(response);
});

// ================================================================
// FUNCTION: Send to MRA and print receipt
// ================================================================
async function sendToMraAndPrint(saleData) {
    try {
        console.log('\n📤 SENDING TO MRA MOCK API...');
        
        const payload = {
            transaction_id: saleData.transaction_id,
            total_amount: saleData.total_amount || 0,
            payment_method: saleData.payment_method || 'unknown',
            products: saleData.products || [],
            account: saleData.account,
            account_number: saleData.account_number,
            timestamp: new Date().toISOString(),
            full_data: saleData
        };
        
        console.log('📦 Payload to MRA:', JSON.stringify(payload, null, 2));
        
        const response = await fetch('https://poster-mra.onrender.com/mra-mock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const mraResponse = await response.json();
        console.log('✅ MRA Response:', JSON.stringify(mraResponse, null, 2));
        
        // Print receipt with QR code
        if (mraResponse.qr_code) {
            console.log('\n🖨️ Printing receipt with QR code...');
            await printReceiptWithQR(saleData, mraResponse);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// ================================================================
// FUNCTION: Print receipt using Poster's API
// ================================================================
async function printReceiptWithQR(saleData, mraResponse) {
    try {
        // CORRECT Poster API endpoint
        const posterApiUrl = 'https://joinposter.com/api';
        
        // The order ID - use the history_time from the sale
        const orderId = saleData.history_time || Date.now();
        
        // The QR code from MRA
        const qrCode = mraResponse.qr_code;
        
        // Title for the QR code
        const qrCodeTitle = 'MRA Invoice';
        
        console.log('📋 Printing receipt for order:', orderId);
        console.log('📋 QR Code:', qrCode);
        console.log('📋 QR Title:', qrCodeTitle);
        
        // Build the request URL
        const url = `${posterApiUrl}/orders.printReceipt`;
        console.log('📋 API URL:', url);
        
        // Call Poster's API to print receipt
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POSTER_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                orderId: orderId,
                qrCode: qrCode,
                qrCodeTitle: qrCodeTitle
            })
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        console.log('📋 Response Content-Type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log('✅ Receipt print response:', JSON.stringify(result, null, 2));
        } else {
            // If not JSON, show the raw response
            const text = await response.text();
            console.log('⚠️ Non-JSON response from Poster API:');
            console.log('📋 Status:', response.status);
            console.log('📋 Response text:', text.substring(0, 500));
            
            // Try to extract error message
            if (response.status === 401 || response.status === 403) {
                console.log('❌ Authentication failed - check your Access Token');
            } else if (response.status === 404) {
                console.log('❌ API endpoint not found - check the URL');
            } else {
                console.log(`❌ API error (${response.status})`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error printing receipt:', error.message);
    }
}

// ================================================================
// HEALTH CHECK
// ================================================================
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString() 
    });
});

// ================================================================
// ROOT ENDPOINT
// ================================================================
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Poster webhook handler is running',
        endpoints: {
            webhook: 'POST /webhook',
            'mra-mock': 'POST /mra-mock',
            health: 'GET /health'
        }
    });
});

// ================================================================
// START SERVER
// ================================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('✅ Server running on port', PORT);
    console.log('📍 Webhook URL: https://poster-mra.onrender.com/webhook');
    console.log('📍 MRA Mock: https://poster-mra.onrender.com/mra-mock');
    console.log('📍 Health: https://poster-mra.onrender.com/health');
    console.log('='.repeat(60));
    console.log('\n⏳ Waiting for webhooks...\n');
});
