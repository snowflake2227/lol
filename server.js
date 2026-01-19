const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// CDEK API credentials - ДОЛЖНЫ БЫТЬ НАСТРОЕНЫ В .env
const CDEK_API_KEY = process.env.CDEK_API_KEY;
const CDEK_API_PASSWORD = process.env.CDEK_API_PASSWORD;

// Validate API credentials
if (!CDEK_API_KEY || !CDEK_API_PASSWORD) {
    console.error('=== ВНИМАНИЕ: CDEK API ключи не настроены! ===');
    console.error('Добавьте в .env файл:');
    console.error('CDEK_API_KEY=ваш_ключ');
    console.error('CDEK_API_PASSWORD=ваш_пароль');
    console.error('Получите ключи на: https://api.cdek.ru/');
    console.error('==========================================');
}

// Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Backend is running',
        timestamp: new Date().toISOString(),
        cdekConfigured: !!(CDEK_API_KEY && CDEK_API_PASSWORD)
    });
});

// CDEK Authentication
app.post('/api/cdek/auth', async (req, res) => {
    try {
        const authUrl = 'https://api.cdek.ru/v2/oauth/token';
        
        const authResponse = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CDEK_API_KEY,
                client_secret: CDEK_API_PASSWORD
            })
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error('CDEK Auth Failed:', {
                status: authResponse.status,
                statusText: authResponse.statusText,
                error: errorText
            });
            
            return res.status(authResponse.status).json({
                error: 'CDEK authentication failed',
                message: errorText,
                details: 'Check your CDEK API credentials in .env file'
            });
        }

        const authData = await authResponse.json();
        res.json(authData);
    } catch (error) {
        console.error('CDEK Auth Error:', error);
        res.status(500).json({ 
            error: 'Authentication error',
            message: error.message,
            details: 'Network error or CDEK API is unavailable'
        });
    }
});

// Search cities in CDEK
app.get('/api/cdek/cities/search', async (req, res) => {
    try {
        const { city, country_code = 'RU', size = 20 } = req.query;
        
        if (!city || city.length < 2) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'City name must be at least 2 characters'
            });
        }
        
        // Get auth token
        const token = await getAuthToken();
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Unable to authenticate with CDEK API'
            });
        }
        
        const citiesUrl = `https://api.cdek.ru/v2/location/cities?city=${encodeURIComponent(city)}&country_codes=${country_code}&size=${size}`;
        
        const response = await fetch(citiesUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Cities API Error:', {
                status: response.status,
                statusText: response.statusText,
                url: citiesUrl
            });
            
            if (response.status === 401) {
                return res.status(401).json({ 
                    error: 'Unauthorized',
                    message: 'Invalid or expired CDEK token'
                });
            }
            
            return res.status(response.status).json({ 
                error: 'Failed to fetch cities',
                message: `CDEK API returned ${response.status}`
            });
        }

        const citiesData = await response.json();
        res.json(citiesData);
    } catch (error) {
        console.error('Cities Search Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get PVZ for city
app.get('/api/cdek/pvz/full', async (req, res) => {
    try {
        const { city_code, type = 'ALL', have_cashless = true, is_handout = true } = req.query;
        
        if (!city_code) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'city_code parameter is required'
            });
        }
        
        // Get auth token
        const token = await getAuthToken();
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Unable to authenticate with CDEK API'
            });
        }
        
        const pvzUrl = `https://api.cdek.ru/v2/deliverypoints?city_code=${city_code}&type=${type}&have_cashless=${have_cashless}&is_handout=${is_handout}`;
        
        const response = await fetch(pvzUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('PVZ API Error:', {
                status: response.status,
                statusText: response.statusText,
                url: pvzUrl
            });
            
            if (response.status === 401) {
                return res.status(401).json({ 
                    error: 'Unauthorized',
                    message: 'Invalid or expired CDEK token'
                });
            }
            
            return res.status(response.status).json({ 
                error: 'Failed to fetch PVZ',
                message: `CDEK API returned ${response.status}`
            });
        }

        const pvzData = await response.json();
        res.json(pvzData);
    } catch (error) {
        console.error('PVZ Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Calculate delivery cost
app.post('/api/cdek/calculate', async (req, res) => {
    try {
        const { from_location, to_location, tariff_code = 136, packages } = req.body;
        
        if (!to_location || !to_location.code) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'to_location with code is required'
            });
        }
        
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'At least one package is required'
            });
        }
        
        // Get auth token
        const token = await getAuthToken();
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Unable to authenticate with CDEK API'
            });
        }
        
        const calculateUrl = 'https://api.cdek.ru/v2/calculator/tarifflist';
        
        const requestData = {
            from_location: from_location || { code: 44 }, // Москва по умолчанию
            to_location: to_location,
            packages: packages,
            services: []
        };
        
        const response = await fetch(calculateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Calculate API Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                requestData: requestData
            });
            
            if (response.status === 401) {
                return res.status(401).json({ 
                    error: 'Unauthorized',
                    message: 'Invalid or expired CDEK token'
                });
            }
            
            return res.status(response.status).json({ 
                error: 'Failed to calculate delivery',
                message: `CDEK API returned ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Calculate Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Create CDEK order
app.post('/api/cdek/order/create', async (req, res) => {
    try {
        const orderData = req.body;
        
        if (!orderData || !orderData.recipient || !orderData.to_location || !orderData.packages) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'Missing required order data'
            });
        }
        
        // Validate required fields
        const requiredFields = ['number', 'tariff_code', 'recipient.name', 'recipient.phones', 'to_location.code'];
        const missingFields = requiredFields.filter(field => {
            const parts = field.split('.');
            let value = orderData;
            for (const part of parts) {
                if (!value || !value[part]) return true;
                value = value[part];
            }
            return false;
        });
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'Missing required fields',
                missingFields: missingFields
            });
        }
        
        // Get auth token
        const token = await getAuthToken();
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Unable to authenticate with CDEK API'
            });
        }
        
        const orderUrl = 'https://api.cdek.ru/v2/orders';
        
        const response = await fetch(orderUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Order Creation Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                orderData: orderData
            });
            
            if (response.status === 401) {
                return res.status(401).json({ 
                    error: 'Unauthorized',
                    message: 'Invalid or expired CDEK token'
                });
            }
            
            return res.status(response.status).json({ 
                error: 'Failed to create order',
                message: `CDEK API returned ${response.status}`,
                details: errorText
            });
        }

        const orderResponse = await response.json();
        res.json(orderResponse);
    } catch (error) {
        console.error('Order Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get order status
app.get('/api/cdek/order/:uuid/status', async (req, res) => {
    try {
        const { uuid } = req.params;
        
        if (!uuid) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'Order UUID is required'
            });
        }
        
        // Get auth token
        const token = await getAuthToken();
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Unable to authenticate with CDEK API'
            });
        }
        
        const statusUrl = `https://api.cdek.ru/v2/orders/${uuid}`;
        
        const response = await fetch(statusUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Order Status Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                uuid: uuid
            });
            
            if (response.status === 401) {
                return res.status(401).json({ 
                    error: 'Unauthorized',
                    message: 'Invalid or expired CDEK token'
                });
            }
            
            if (response.status === 404) {
                return res.status(404).json({ 
                    error: 'Order not found',
                    message: 'Order with specified UUID not found'
                });
            }
            
            return res.status(response.status).json({ 
                error: 'Failed to get order status',
                message: `CDEK API returned ${response.status}`,
                details: errorText
            });
        }

        const statusData = await response.json();
        res.json(statusData);
    } catch (error) {
        console.error('Status Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Payment initialization
app.post('/api/payment/init', async (req, res) => {
    try {
        const { orderId, amount, customer, items, description } = req.body;
        
        if (!orderId || !amount || !customer) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'Missing required payment data'
            });
        }
        
        // Здесь должна быть интеграция с реальным платежным шлюзом
        // Например: Тинькофф, ЮKassa, CloudPayments
        
        // Временно возвращаем успешный ответ для тестирования
        res.json({
            Success: true,
            PaymentURL: null, // URL для редиректа на платежную страницу
            PaymentId: `pmt_${Date.now()}`,
            Message: 'Payment initialized successfully',
            OrderId: orderId,
            Amount: amount
        });
    } catch (error) {
        console.error('Payment Init Error:', error);
        res.status(500).json({ 
            Success: false,
            Message: 'Payment initialization failed',
            Error: error.message
        });
    }
});

// Process payment
app.post('/api/payment/process', async (req, res) => {
    try {
        const { orderId, amount, card } = req.body;
        
        if (!orderId || !amount || !card) {
            return res.status(400).json({ 
                Success: false,
                Message: 'Missing required payment data'
            });
        }
        
        // Здесь должна быть обработка реального платежа
        // Временная симуляция успешного платежа
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        res.json({
            Success: true,
            TransactionId: `txn_${Date.now()}`,
            Amount: amount,
            Message: 'Payment processed successfully',
            OrderId: orderId,
            Timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Payment Process Error:', error);
        res.status(500).json({ 
            Success: false,
            Message: 'Payment processing failed',
            Error: error.message
        });
    }
});

// Send order notifications
app.post('/api/notify/order', async (req, res) => {
    try {
        const order = req.body;
        
        console.log('Order notification received:', {
            orderId: order.id,
            customer: order.customer?.name,
            phone: order.customer?.phone,
            email: order.customer?.email,
            total: order.total,
            delivery: order.delivery?.city?.name,
            timestamp: new Date().toISOString()
        });
        
        // Здесь должна быть отправка email/SMS через сервис
        // Например: SendGrid, Mailgun, Twilio
        
        res.json({ 
            success: true, 
            message: 'Notification logged',
            orderId: order.id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Notification Error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to send notification',
            message: error.message
        });
    }
});

// Send payment notifications
app.post('/api/notify/payment', async (req, res) => {
    try {
        const { orderId, amount, customer, paymentMethod } = req.body;
        
        console.log('Payment notification received:', {
            orderId: orderId,
            amount: amount,
            customer: customer?.name,
            paymentMethod: paymentMethod,
            timestamp: new Date().toISOString()
        });
        
        // Здесь должна быть отправка уведомления о платеже
        
        res.json({ 
            success: true, 
            message: 'Payment notification logged',
            orderId: orderId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Payment Notification Error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to send payment notification',
            message: error.message
        });
    }
});

// Cache for auth token
let authTokenCache = {
    token: null,
    expiresAt: 0
};

// Helper function to get auth token with caching
async function getAuthToken() {
    try {
        // Check if cached token is still valid (expires in 5 minutes)
        if (authTokenCache.token && authTokenCache.expiresAt > Date.now() + 300000) {
            return authTokenCache.token;
        }
        
        const authUrl = 'https://api.cdek.ru/v2/oauth/token';
        
        const authResponse = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CDEK_API_KEY,
                client_secret: CDEK_API_PASSWORD
            })
        });

        if (!authResponse.ok) {
            console.error('Failed to get auth token:', {
                status: authResponse.status,
                statusText: authResponse.statusText
            });
            return null;
        }

        const authData = await authResponse.json();
        
        // Cache the token
        authTokenCache = {
            token: authData.access_token,
            expiresAt: Date.now() + (authData.expires_in * 1000)
        };
        
        console.log('New CDEK token obtained, expires in:', authData.expires_in, 'seconds');
        
        return authData.access_token;
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Start server
app.listen(PORT, () => {
    console.log('=== Illusive Store Backend (БОЕВОЙ РЕЖИМ) ===');
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`CDEK API configured: ${CDEK_API_KEY ? 'YES' : 'NO (add credentials to .env)'}`);
    if (!CDEK_API_KEY || !CDEK_API_PASSWORD) {
        console.log('\n=== ВНИМАНИЕ ===');
        console.log('Для работы с СДЭК необходимо:');
        console.log('1. Получить API ключи на https://api.cdek.ru/');
        console.log('2. Создать файл .env в корне проекта');
        console.log('3. Добавить в .env:');
        console.log('   CDEK_API_KEY=your_client_id');
        console.log('   CDEK_API_PASSWORD=your_client_secret');
        console.log('================\n');
    }
    console.log('============================================');
});
