// ================================================================
// 1. IMPORTS & SETUP
// ================================================================

// Import the Express framework - this lets us create a web server
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// 2. MIDDLEWARE - Runs BEFORE any request is handled
// ================================================================

// This tells Express to automatically parse JSON data in incoming requests
// Without this, req.body would be undefined
app.use(express.json());

// This is a logging middleware - it runs for EVERY request
// It logs: the method (GET/POST), the URL, headers, and body
app.use((req, res, next) => {
    console.log('\n' + '='.repeat(60));
    console.log(`📥 ${req.method} request to ${req.url}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
    console.log('='.repeat(60) + '\n');
    // next() tells Express to continue to the next handler
    next();
});

// ================================================================
// 3. MAIN WEBHOOK ENDPOINT - This is where Poster sends data
// ================================================================

// When Poster sends a POST request to /webhook, this code runs
app.post('/webhook', (req, res) => {
    
    // ============================================================
    // 3a. LOG THAT WE RECEIVED A WEBHOOK
    // ============================================================
    
    console.log('\n' + '🔥'.repeat(30));
    console.log('🔥🔥🔥 WEBHOOK RECEIVED FROM POSTER! 🔥🔥🔥');
    console.log('🔥'.repeat(30) + '\n');
    
    // ============================================================
    // 3b. DISPLAY THE RAW DATA (for debugging)
    // ============================================================
    
    console.log('📦 RAW DATA RECEIVED:');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('\n');
    
    // ============================================================
    // 3c. DISPLAY KEY FIELDS (for easy reading)
    // ============================================================
    
    // We check both English AND French field names because Poster
    // might send either depending on the language setting
    console.log('📌 KEY FIELDS:');
    console.log(`   Object: ${req.body.object || req.body.objet || 'NOT FOUND'}`);
    console.log(`   Action: ${req.body.action || 'NOT FOUND'}`);
    console.log(`   Account: ${req.body.account || req.body.compte || 'NOT FOUND'}`);
    console.log(`   Object ID: ${req.body.object_id || req.body.id_objet || 'NOT FOUND'}`);
    console.log(`   Time: ${req.body.time || req.body.temps || 'NOT FOUND'}`);
    console.log(`   Verify: ${req.body.verify || req.body.vérifier || 'NOT FOUND'}`);
    
    // The 'data' field contains the detailed transaction info as a JSON string
    if (req.body.data) {
        console.log(`   Data:`, JSON.stringify(req.body.data, null, 2));
    }
    if (req.body.données) {
        console.log(`   Data (French):`, JSON.stringify(req.body.données, null, 2));
    }
    
    console.log('\n' + '='.repeat(60) + '\n');

    // ============================================================
    // 3d. PROCESS ONLY THE "closed" ACTION (FINAL SALE)
    // ============================================================
    // Poster sends multiple webhooks during a transaction:
    // - "added" : when the order is opened
    // - "changed" : when items are added/removed
    // - "closed" : when the sale is completed and paid
    // We only care about "closed" because that has ALL the final data
    
    if (req.body.action === 'closed' && req.body.object === 'transaction') {
        console.log('\n💰💰💰 SALE COMPLETED! Processing for MRA... 💰💰💰');
        
        // ============================================================
        // 3e. PARSE THE "data" FIELD
        // ============================================================
        // The 'data' field in Poster webhooks is a JSON string, not an object
        // We need to parse it to access the nested information
        
        let parsedData = null;
        if (req.body.data) {
            try {
                // Convert the JSON string into a JavaScript object
                parsedData = JSON.parse(req.body.data);
                console.log('✅ Data parsed successfully!');
            } catch (e) {
                // If parsing fails, we'll continue with null
                console.log('⚠️ Could not parse data field');
            }
        }
        
        // ============================================================
        // 3f. EXTRACT ALL THE INFORMATION
        // ============================================================
        // We create a clean object with ALL the data we need
        
        // Start with the basic fields from the main webhook
        const saleData = {
            // These come directly from the webhook body
            account: req.body.account || '',
            account_number: req.body.account_number || '',
            transaction_id: req.body.object_id || 0,
            action: req.body.action || '',
            time: req.body.time || '',
            verify: req.body.verify || '',
            
            // This will contain the parsed data (or null if parsing failed)
            parsed_data: parsedData || null
        };
        
        // ============================================================
        // 3g. EXTRACT DETAILS FROM THE PARSED DATA
        // ============================================================
        // The parsed data has a structure like:
        // {
        //   "transactions_history": {
        //     "type_history": "close",
        //     "value": 3,        // total amount
        //     "value2": 300,     // amount in cents
        //     "value_text": "{ \"payments\": { \"cash\": 3 }, ... }",
        //     "user_id": 4,
        //     ...
        //   }
        // }
        
        if (parsedData && parsedData.transactions_history) {
            const history = parsedData.transactions_history;
            
            // Extract the top-level history fields
            saleData.type_history = history.type_history || '';
            saleData.history_time = history.time || 0;
            saleData.value = history.value || 0;           // Total amount
            saleData.value2 = history.value2 || 0;         // Amount in cents
            saleData.value3 = history.value3 || 0;
            saleData.value4 = history.value4 || 0;
            saleData.value5 = history.value5 || null;
            saleData.value_text = history.value_text || ''; // JSON string with payments/products
            saleData.user_id = history.user_id || 0;       // Staff member who processed the sale
            saleData.spot_tablet_id = history.spot_tablet_id || 0; // Which tablet was used
            
            // ============================================================
            // 3h. PARSE THE value_text FIELD
            // ============================================================
            // The value_text field is a JSON string containing payment details
            // Example: {"payments":{"cash":3},"products":[{"id":3,"count":1}]}
            
            if (history.value_text) {
                try {
                    const details = JSON.parse(history.value_text);
                    saleData.payment_details = details;
                    
                    // Extract payment method and amount
                    // If payments are: {"cash": 3}, then cash is the method and 3 is the amount
                    if (details.payments) {
                        // Get the first payment method (e.g., "cash" or "card")
                        saleData.payment_method = Object.keys(details.payments)[0] || 'unknown';
                        // Get the amount for that payment method
                        saleData.total_amount = details.payments[saleData.payment_method] || 0;
                    }
                    
                    // Extract product list
                    if (details.products) {
                        saleData.products = details.products;
                    }
                    
                } catch (e) {
                    console.log('⚠️ Could not parse value_text');
                }
            }
        }
        
        // ============================================================
        // 3i. LOG THE COMPLETE EXTRACTED DATA
        // ============================================================
        
        console.log('\n📊 COMPLETE SALE DATA EXTRACTED:');
        console.log(JSON.stringify(saleData, null, 2));
        
        // ============================================================
        // 3j. SEND TO MRA MOCK API
        // ============================================================
        // This is where we call the function that sends data to our mock MRA API
        // The mock API will return a fake QR code for testing
        
        sendToMraMock(saleData);
        
        console.log('✅ Sale data sent to MRA mock endpoint!');
    }
    
    // ============================================================
    // 3k. ALWAYS RESPOND WITH 200 OK
    // ============================================================
    // Poster requires a 200 OK response. If we don't send this,
    // Poster will keep retrying the webhook (up to 15 times)
    
    res.status(200).json({
        status: 'accepted',
        message: 'Webhook received successfully',
        timestamp: new Date().toISOString()
    });
});

// ================================================================
// 4. MRA MOCK API - Simulates the real MRA API
// ================================================================
// This is a fake API that acts like the real MRA system
// It accepts invoice data and returns a fake QR code
// This is for testing purposes ONLY

app.post('/mra-mock', (req, res) => {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 MRA MOCK API CALLED!');
    
    const mraData = req.body;
    console.log('📦 Data received by mock:', JSON.stringify(mraData, null, 2));
    
    // ============================================================
    // 4a. GENERATE A FAKE QR CODE
    // ============================================================
    // For testing, we generate a unique fake QR code
    // In production, the real MRA API would return a real QR code
    
    // Date.now() gives a unique timestamp
    // Math.random() gives a random string to ensure uniqueness
    const fakeQR = `FAKE-QR-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Generate a fake invoice number
    const fakeInvoice = `INV-${String(mraData.transaction_id || 0).padStart(6, '0')}`;
    
    // ============================================================
    // 4b. SIMULATE PROCESSING DELAY
    // ============================================================
    // Real MRA API takes time to process. We simulate this with a log message
    console.log('⏳ Processing...');
    
    // ============================================================
    // 4c. SEND THE RESPONSE
    // ============================================================
    // This is what the mock API returns to the caller
    // It mimics what a real MRA API would return
    
    const response = {
        success: true,
        qr_code: fakeQR,              // The fake QR code
        invoice_number: fakeInvoice,  // The fake invoice number
        timestamp: new Date().toISOString(),
        message: 'Mock MRA response - QR code generated for testing'
    };
    
    console.log('✅ Mock response sent:', JSON.stringify(response, null, 2));
    console.log('='.repeat(60) + '\n');
    
    // Send the response as JSON with status 200 OK
    res.status(200).json(response);
});

// ================================================================
// 5. FUNCTION TO SEND DATA TO MRA MOCK
// ================================================================
// This is the function that sends the sale data to our mock API
// It uses the fetch() function to make an HTTP POST request

async function sendToMraMock(saleData) {
    try {
        console.log('\n📤 SENDING TO MRA MOCK API...');
        
        // ============================================================
        // 5a. FORMAT THE PAYLOAD
        // ============================================================
        // We create a clean JSON object with the data we want to send
        // The mock API expects this format
        
        const payload = {
            transaction_id: saleData.transaction_id,
            total_amount: saleData.total_amount || 0,
            payment_method: saleData.payment_method || 'unknown',
            products: saleData.products || [],
            account: saleData.account,
            account_number: saleData.account_number,
            timestamp: new Date().toISOString(),
            // We also send the full data in case the mock needs extra info
            full_data: saleData
        };
        
        console.log('📦 Payload to MRA:', JSON.stringify(payload, null, 2));
        
        // ============================================================
        // 5b. SEND THE REQUEST
        // ============================================================
        // fetch() makes an HTTP request to our own mock API
        // This is like calling: POST https://poster-mra.onrender.com/mra-mock
        
        const response = await fetch('https://poster-mra.onrender.com/mra-mock', {
            method: 'POST',                          // HTTP method
            headers: {
                'Content-Type': 'application/json'   // We're sending JSON
            },
            body: JSON.stringify(payload)            // Convert our data to JSON string
        });
        
        // ============================================================
        // 5c. PROCESS THE RESPONSE
        // ============================================================
        const result = await response.json();
        console.log('✅ MRA Mock Response:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        // If the fetch fails (e.g., network error), log the error
        console.error('❌ Error sending to MRA mock:', error.message);
    }
}

// ================================================================
// 6. HEALTH CHECK ENDPOINT
// ================================================================
// This is used by monitoring tools to check if the server is running
// UptimeRobot can ping this to keep the service awake

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString() 
    });
});

// ================================================================
// 7. ROOT ENDPOINT
// ================================================================
// This shows the available endpoints when you visit the base URL
// Useful for checking what the server can do

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
// 8. START THE SERVER
// ================================================================
// This actually starts the server and listens for incoming requests
// The server will run until you stop it

app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('✅ Server running on port', PORT);
    console.log('📍 Webhook URL: https://poster-mra.onrender.com/webhook');
    console.log('📍 MRA Mock: https://poster-mra.onrender.com/mra-mock');
    console.log('📍 Health: https://poster-mra.onrender.com/health');
    console.log('='.repeat(60));
    console.log('\n⏳ Waiting for webhooks...\n');
});
