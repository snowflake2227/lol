const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// CDEK API credentials (в реальном проекте хранить в .env)
const CDEK_API_KEY = process.env.CDEK_API_KEY || 'IZXbP5gbWNq0TJQdXcdVTT3x3J349HGe';
const CDEK_API_PASSWORD = process.env.CDEK_API_PASSWORD || 'OatOZl0Zungypwe807b4pYxNmZgsgMrX';

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend is running' });
});

// CDEK Authentication
app.post('/api/cdek/auth', async (req, res) => {
    try {
        const authUrl = 'https://api.edu.cdek.ru/v2/oauth/token';
        
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
            throw new Error('Auth failed');
        }

        const authData = await authResponse.json();
        res.json(authData);
    } catch (error) {
        console.error('CDEK Auth Error:', error);
        res.status(500).json({ 
            error: 'Auth failed', 
            message: error.message,
            // Demo token for development
            access_token: 'demo-token-' + Date.now(),
            expires_in: 3600
        });
    }
});

// Search cities in CDEK
app.get('/api/cdek/cities', async (req, res) => {
    try {
        const { city } = req.query;
        
        // Get auth token
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            // Return demo cities
            const demoCities = [
                { code: '44', city: 'Москва', region: 'Московская область', name: 'Москва', country_code: 'RU' },
                { code: '137', city: 'Санкт-Петербург', region: 'Ленинградская область', name: 'Санкт-Петербург', country_code: 'RU' },
                { code: '151', city: 'Казань', region: 'Татарстан', name: 'Казань', country_code: 'RU' },
                { code: '54', city: 'Новосибирск', region: 'Новосибирская область', name: 'Новосибирск', country_code: 'RU' },
                { code: '77', city: 'Екатеринбург', region: 'Свердловская область', name: 'Екатеринбург', country_code: 'RU' }
            ];
            
            const filteredCities = demoCities.filter(c => 
                c.city.toLowerCase().includes(city?.toLowerCase() || '') ||
                c.name.toLowerCase().includes(city?.toLowerCase() || '')
            );
            
            return res.json(filteredCities);
        }

        const citiesUrl = `https://api.edu.cdek.ru/v2/location/cities?city=${encodeURIComponent(city || '')}`;
        
        const response = await fetch(citiesUrl, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch cities');
        }

        const citiesData = await response.json();
        res.json(citiesData);
    } catch (error) {
        console.error('Cities Error:', error);
        res.status(500).json({ error: 'Failed to fetch cities' });
    }
});

// Get PVZ for city
app.get('/api/cdek/pvz', async (req, res) => {
    try {
        const { city_code } = req.query;
        
        // Get auth token
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            // Return demo PVZ
            const demoPVZ = [
                { 
                    code: 'PVZ001', 
                    name: 'Пункт выдачи #1', 
                    location: { address: 'ул. Центральная, д. 10' },
                    work_time: 'Пн-Пт: 09:00-20:00, Сб-Вс: 10:00-18:00'
                },
                { 
                    code: 'PVZ002', 
                    name: 'Пункт выдачи #2', 
                    location: { address: 'пр. Ленина, д. 45' },
                    work_time: 'Ежедневно: 10:00-22:00'
                },
                { 
                    code: 'PVZ003', 
                    name: 'Пункт выдачи #3', 
                    location: { address: 'ул. Торговая, д. 15, ТЦ "Меркурий"' },
                    work_time: 'Пн-Вс: 08:00-21:00'
                }
            ];
            
            return res.json(demoPVZ);
        }

        const pvzUrl = `https://api.edu.cdek.ru/v2/deliverypoints?city_code=${city_code}`;
        
        const response = await fetch(pvzUrl, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch PVZ');
        }

        const pvzData = await response.json();
        res.json(pvzData);
    } catch (error) {
        console.error('PVZ Error:', error);
        res.status(500).json({ error: 'Failed to fetch PVZ' });
    }
});

// Create CDEK order
app.post('/api/cdek/order', async (req, res) => {
    try {
        const orderData = req.body;
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            // Demo response
            return res.json({
                uuid: 'demo-' + Date.now(),
                entity: orderData
            });
        }

        const orderUrl = 'https://api.edu.cdek.ru/v2/orders';
        
        const response = await fetch(orderUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error('Failed to create order');
        }

        const orderResponse = await response.json();
        res.json(orderResponse);
    } catch (error) {
        console.error('Order Error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Payment initialization
app.post('/api/payment/init', async (req, res) => {
    try {
        const { orderId, amount, customer, items, description } = req.body;
        
        // Здесь должна быть интеграция с реальным платежным шлюзом
        // Пока возвращаем демо-ответ
        
        res.json({
            Success: true,
            PaymentURL: null,
            PaymentId: 'demo-' + Date.now(),
            Message: 'Payment initialized (demo mode)'
        });
    } catch (error) {
        console.error('Payment Init Error:', error);
        res.status(500).json({ 
            Success: false,
            Message: 'Payment initialization failed'
        });
    }
});

// Process payment
app.post('/api/payment/process', async (req, res) => {
    try {
        const { orderId, amount, card } = req.body;
        
        // Здесь должна быть обработка реального платежа
        // Пока симулируем успешный платеж
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        res.json({
            Success: true,
            TransactionId: 'demo-txn-' + Date.now(),
            Amount: amount,
            Message: 'Payment processed successfully (demo)'
        });
    } catch (error) {
        console.error('Payment Process Error:', error);
        res.status(500).json({ 
            Success: false,
            Message: 'Payment processing failed'
        });
    }
});

// Send notifications
app.post('/api/notify/order', async (req, res) => {
    try {
        const order = req.body;
        
        console.log('Order notification received:', {
            orderId: order.id,
            customer: order.customer.name,
            total: order.total
        });
        
        // Здесь должна быть отправка email/SMS
        // Пока просто логируем
        
        res.json({ success: true, message: 'Notification logged' });
    } catch (error) {
        console.error('Notification Error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
