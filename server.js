const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// CDEK API credentials
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
            access_token: 'demo-token-' + Date.now(),
            expires_in: 3600
        });
    }
});

// Get all cities from CDEK with pagination
app.get('/api/cdek/cities/all', async (req, res) => {
    try {
        const { page = 1, size = 50, country_code = 'RU', region_code } = req.query;
        
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            // Возвращаем все города России (основные)
            const allRussianCities = [
                // Центральный федеральный округ
                { code: 44, city: 'Москва', region: 'Московская область', country_code: 'RU', country: 'Россия' },
                { code: 250, city: 'Тула', region: 'Тульская область', country_code: 'RU', country: 'Россия' },
                { code: 243, city: 'Калуга', region: 'Калужская область', country_code: 'RU', country: 'Россия' },
                { code: 435, city: 'Рязань', region: 'Рязанская область', country_code: 'RU', country: 'Россия' },
                { code: 426, city: 'Смоленск', region: 'Смоленская область', country_code: 'RU', country: 'Россия' },
                { code: 137, city: 'Санкт-Петербург', region: 'Ленинградская область', country_code: 'RU', country: 'Россия' },
                
                // Приволжский федеральный округ
                { code: 151, city: 'Казань', region: 'Татарстан', country_code: 'RU', country: 'Россия' },
                { code: 442, city: 'Самара', region: 'Самарская область', country_code: 'RU', country: 'Россия' },
                { code: 470, city: 'Уфа', region: 'Башкортостан', country_code: 'RU', country: 'Россия' },
                { code: 185, city: 'Пермь', region: 'Пермский край', country_code: 'RU', country: 'Россия' },
                { code: 434, city: 'Саратов', region: 'Саратовская область', country_code: 'RU', country: 'Россия' },
                
                // Сибирский федеральный округ
                { code: 54, city: 'Новосибирск', region: 'Новосибирская область', country_code: 'RU', country: 'Россия' },
                { code: 77, city: 'Екатеринбург', region: 'Свердловская область', country_code: 'RU', country: 'Россия' },
                { code: 142, city: 'Омск', region: 'Омская область', country_code: 'RU', country: 'Россия' },
                { code: 227, city: 'Красноярск', region: 'Красноярский край', country_code: 'RU', country: 'Россия' },
                { code: 66, city: 'Иркутск', region: 'Иркутская область', country_code: 'RU', country: 'Россия' },
                
                // Южный федеральный округ
                { code: 56, city: 'Ростов-на-Дону', region: 'Ростовская область', country_code: 'RU', country: 'Россия' },
                { code: 398, city: 'Краснодар', region: 'Краснодарский край', country_code: 'RU', country: 'Россия' },
                { code: 205, city: 'Волгоград', region: 'Волгоградская область', country_code: 'RU', country: 'Россия' },
                { code: 357, city: 'Ставрополь', region: 'Ставропольский край', country_code: 'RU', country: 'Россия' },
                
                // Северо-Западный федеральный округ
                { code: 159, city: 'Мурманск', region: 'Мурманская область', country_code: 'RU', country: 'Россия' },
                { code: 31, city: 'Архангельск', region: 'Архангельская область', country_code: 'RU', country: 'Россия' },
                
                // Уральский федеральный округ
                { code: 173, city: 'Челябинск', region: 'Челябинская область', country_code: 'RU', country: 'Россия' },
                { code: 126, city: 'Тюмень', region: 'Тюменская область', country_code: 'RU', country: 'Россия' },
                
                // Дальневосточный федеральный округ
                { code: 104, city: 'Владивосток', region: 'Приморский край', country_code: 'RU', country: 'Россия' },
                { code: 113, city: 'Хабаровск', region: 'Хабаровский край', country_code: 'RU', country: 'Россия' },
                { code: 385, city: 'Якутск', region: 'Саха (Якутия)', country_code: 'RU', country: 'Россия' }
            ];
            
            const start = (page - 1) * size;
            const end = start + parseInt(size);
            const paginatedCities = allRussianCities.slice(start, end);
            
            return res.json({
                data: paginatedCities,
                meta: {
                    total: allRussianCities.length,
                    page: parseInt(page),
                    size: parseInt(size),
                    pages: Math.ceil(allRussianCities.length / size)
                }
            });
        }

        let citiesUrl = `https://api.edu.cdek.ru/v2/location/cities?country_codes=${country_code}&size=${size}&page=${page}`;
        
        if (region_code) {
            citiesUrl += `&region_code=${region_code}`;
        }
        
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

// Search cities in CDEK with full data
app.get('/api/cdek/cities/search', async (req, res) => {
    try {
        const { city, country_code = 'RU', size = 20 } = req.query;
        
        if (!city || city.length < 2) {
            return res.json({ data: [], meta: { total: 0 } });
        }
        
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            const demoCities = [
                // Полный список городов России
                { code: 44, city: 'Москва', region: 'Московская область', country_code: 'RU', country: 'Россия' },
                { code: 137, city: 'Санкт-Петербург', region: 'Ленинградская область', country_code: 'RU', country: 'Россия' },
                { code: 151, city: 'Казань', region: 'Татарстан', country_code: 'RU', country: 'Россия' },
                { code: 54, city: 'Новосибирск', region: 'Новосибирская область', country_code: 'RU', country: 'Россия' },
                { code: 77, city: 'Екатеринбург', region: 'Свердловская область', country_code: 'RU', country: 'Россия' },
                { code: 56, city: 'Ростов-на-Дону', region: 'Ростовская область', country_code: 'RU', country: 'Россия' },
                { code: 250, city: 'Тула', region: 'Тульская область', country_code: 'RU', country: 'Россия' },
                { code: 243, city: 'Калуга', region: 'Калужская область', country_code: 'RU', country: 'Россия' },
                { code: 435, city: 'Рязань', region: 'Рязанская область', country_code: 'RU', country: 'Россия' },
                { code: 426, city: 'Смоленск', region: 'Смоленская область', country_code: 'RU', country: 'Россия' },
                { code: 442, city: 'Самара', region: 'Самарская область', country_code: 'RU', country: 'Россия' },
                { code: 470, city: 'Уфа', region: 'Башкортостан', country_code: 'RU', country: 'Россия' },
                { code: 185, city: 'Пермь', region: 'Пермский край', country_code: 'RU', country: 'Россия' },
                { code: 434, city: 'Саратов', region: 'Саратовская область', country_code: 'RU', country: 'Россия' },
                { code: 142, city: 'Омск', region: 'Омская область', country_code: 'RU', country: 'Россия' },
                { code: 227, city: 'Красноярск', region: 'Красноярский край', country_code: 'RU', country: 'Россия' },
                { code: 66, city: 'Иркутск', region: 'Иркутская область', country_code: 'RU', country: 'Россия' },
                { code: 398, city: 'Краснодар', region: 'Краснодарский край', country_code: 'RU', country: 'Россия' },
                { code: 205, city: 'Волгоград', region: 'Волгоградская область', country_code: 'RU', country: 'Россия' },
                { code: 357, city: 'Ставрополь', region: 'Ставропольский край', country_code: 'RU', country: 'Россия' },
                { code: 159, city: 'Мурманск', region: 'Мурманская область', country_code: 'RU', country: 'Россия' },
                { code: 31, city: 'Архангельск', region: 'Архангельская область', country_code: 'RU', country: 'Россия' },
                { code: 173, city: 'Челябинск', region: 'Челябинская область', country_code: 'RU', country: 'Россия' },
                { code: 126, city: 'Тюмень', region: 'Тюменская область', country_code: 'RU', country: 'Россия' },
                { code: 104, city: 'Владивосток', region: 'Приморский край', country_code: 'RU', country: 'Россия' },
                { code: 113, city: 'Хабаровск', region: 'Хабаровский край', country_code: 'RU', country: 'Россия' },
                { code: 385, city: 'Якутск', region: 'Саха (Якутия)', country_code: 'RU', country: 'Россия' },
                { code: 51, city: 'Нижний Новгород', region: 'Нижегородская область', country_code: 'RU', country: 'Россия' },
                { code: 295, city: 'Воронеж', region: 'Воронежская область', country_code: 'RU', country: 'Россия' },
                { code: 69, city: 'Кемерово', region: 'Кемеровская область', country_code: 'RU', country: 'Россия' },
                { code: 76, city: 'Томск', region: 'Томская область', country_code: 'RU', country: 'Россия' },
                { code: 135, city: 'Барнаул', region: 'Алтайский край', country_code: 'RU', country: 'Россия' },
                { code: 369, city: 'Ульяновск', region: 'Ульяновская область', country_code: 'RU', country: 'Россия' },
                { code: 287, city: 'Орёл', region: 'Орловская область', country_code: 'RU', country: 'Россия' },
                { code: 271, city: 'Липецк', region: 'Липецкая область', country_code: 'RU', country: 'Россия' },
                { code: 326, city: 'Белгород', region: 'Белгородская область', country_code: 'RU', country: 'Россия' },
                { code: 304, city: 'Курск', region: 'Курская область', country_code: 'RU', country: 'Россия' },
                { code: 313, city: 'Брянск', region: 'Брянская область', country_code: 'RU', country: 'Россия' },
                { code: 341, city: 'Владимир', region: 'Владимирская область', country_code: 'RU', country: 'Россия' },
                { code: 362, city: 'Иваново', region: 'Ивановская область', country_code: 'RU', country: 'Россия' },
                { code: 425, city: 'Кострома', region: 'Костромская область', country_code: 'RU', country: 'Россия' },
                { code: 438, city: 'Ярославль', region: 'Ярославская область', country_code: 'RU', country: 'Россия' },
                { code: 456, city: 'Тверь', region: 'Тверская область', country_code: 'RU', country: 'Россия' },
                { code: 445, city: 'Вологда', region: 'Вологодская область', country_code: 'RU', country: 'Россия' },
                { code: 179, city: 'Псков', region: 'Псковская область', country_code: 'RU', country: 'Россия' },
                { code: 166, city: 'Великий Новгород', region: 'Новгородская область', country_code: 'RU', country: 'Россия' },
                { code: 190, city: 'Петрозаводск', region: 'Карелия', country_code: 'RU', country: 'Россия' },
                { code: 96, city: 'Сыктывкар', region: 'Коми', country_code: 'RU', country: 'Россия' },
                { code: 218, city: 'Магадан', region: 'Магаданская область', country_code: 'RU', country: 'Россия' },
                { code: 197, city: 'Южно-Сахалинск', region: 'Сахалинская область', country_code: 'RU', country: 'Россия' },
                { code: 212, city: 'Петропавловск-Камчатский', region: 'Камчатский край', country_code: 'RU', country: 'Россия' },
                { code: 399, city: 'Сочи', region: 'Краснодарский край', country_code: 'RU', country: 'Россия' },
                { code: 416, city: 'Анапа', region: 'Краснодарский край', country_code: 'RU', country: 'Россия' },
                { code: 420, city: 'Геленджик', region: 'Краснодарский край', country_code: 'RU', country: 'Россия' },
                { code: 403, city: 'Новороссийск', region: 'Краснодарский край', country_code: 'RU', country: 'Россия' }
            ];
            
            const searchTerm = city.toLowerCase();
            const filteredCities = demoCities.filter(c => 
                c.city.toLowerCase().includes(searchTerm) ||
                c.region.toLowerCase().includes(searchTerm)
            ).slice(0, size);
            
            return res.json({
                data: filteredCities,
                meta: { total: filteredCities.length }
            });
        }

        const citiesUrl = `https://api.edu.cdek.ru/v2/location/cities?city=${encodeURIComponent(city)}&country_codes=${country_code}&size=${size}`;
        
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
        console.error('Cities Search Error:', error);
        res.status(500).json({ error: 'Failed to fetch cities' });
    }
});

// Get PVZ for city with full data
app.get('/api/cdek/pvz/full', async (req, res) => {
    try {
        const { city_code, type = 'ALL', have_cashless = true } = req.query;
        
        if (!city_code) {
            return res.json({ data: [], meta: { total: 0 } });
        }
        
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            // Демо-данные ПВЗ для разных городов
            const demoPVZByCity = {
                '44': [ // Москва
                    { 
                        code: 'PVZ001', 
                        name: 'Пункт выдачи СДЭК #1', 
                        location: { 
                            address: 'ул. Тверская, д. 10, стр. 1',
                            city_code: 44,
                            city: 'Москва'
                        },
                        work_time: 'Пн-Пт: 09:00-20:00, Сб-Вс: 10:00-18:00',
                        type: 'PVZ',
                        is_handout: true,
                        is_reception: true
                    },
                    { 
                        code: 'PVZ002', 
                        name: 'Пункт выдачи СДЭК #2', 
                        location: { 
                            address: 'пр. Мира, д. 45, офис 12',
                            city_code: 44,
                            city: 'Москва'
                        },
                        work_time: 'Ежедневно: 10:00-22:00',
                        type: 'PVZ',
                        is_handout: true,
                        is_reception: true
                    }
                ],
                '137': [ // Санкт-Петербург
                    { 
                        code: 'PVZ101', 
                        name: 'Пункт выдачи СДЭК СПб #1', 
                        location: { 
                            address: 'Невский пр., д. 28',
                            city_code: 137,
                            city: 'Санкт-Петербург'
                        },
                        work_time: 'Пн-Вс: 09:00-21:00',
                        type: 'PVZ',
                        is_handout: true,
                        is_reception: true
                    }
                ],
                '151': [ // Казань
                    { 
                        code: 'PVZ151', 
                        name: 'Пункт выдачи СДЭК Казань', 
                        location: { 
                            address: 'ул. Баумана, д. 15',
                            city_code: 151,
                            city: 'Казань'
                        },
                        work_time: 'Пн-Пт: 10:00-19:00, Сб: 10:00-16:00',
                        type: 'PVZ',
                        is_handout: true,
                        is_reception: true
                    }
                ],
                '54': [ // Новосибирск
                    { 
                        code: 'PVZ054', 
                        name: 'Пункт выдачи СДЭК Новосибирск', 
                        location: { 
                            address: 'Красный проспект, д. 32',
                            city_code: 54,
                            city: 'Новосибирск'
                        },
                        work_time: 'Пн-Пт: 09:00-20:00',
                        type: 'PVZ',
                        is_handout: true,
                        is_reception: true
                    }
                ],
                '77': [ // Екатеринбург
                    { 
                        code: 'PVZ077', 
                        name: 'Пункт выдачи СДЭК Екатеринбург', 
                        location: { 
                            address: 'ул. Ленина, д. 50',
                            city_code: 77,
                            city: 'Екатеринбург'
                        },
                        work_time: 'Пн-Вс: 08:00-20:00',
                        type: 'PVZ',
                        is_handout: true,
                        is_reception: true
                    }
                ]
            };
            
            const demoPVZ = demoPVZByCity[city_code] || [
                { 
                    code: 'PVZ999', 
                    name: 'Пункт выдачи СДЭК', 
                    location: { 
                        address: 'ул. Центральная, д. 1',
                        city_code: parseInt(city_code),
                        city: 'Город'
                    },
                    work_time: 'Пн-Пт: 09:00-18:00',
                    type: 'PVZ',
                    is_handout: true,
                    is_reception: true
                }
            ];
            
            return res.json({
                data: demoPVZ,
                meta: { total: demoPVZ.length }
            });
        }

        const pvzUrl = `https://api.edu.cdek.ru/v2/deliverypoints?city_code=${city_code}&type=${type}&have_cashless=${have_cashless}`;
        
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

// Calculate delivery cost
app.post('/api/cdek/calculate', async (req, res) => {
    try {
        const { from_location, to_location, tariff_code = 136, packages } = req.body;
        
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            // Демо-расчет стоимости
            const baseCost = 250; // Базовая стоимость
            const distanceCost = to_location?.code === 44 ? 0 : 100; // Если не Москва, дороже
            const totalCost = baseCost + distanceCost;
            
            return res.json({
                tariff_codes: [{
                    tariff_code: 136,
                    tariff_name: 'Посылка склад-склад',
                    tariff_description: 'Доставка до пункта выдачи забора',
                    delivery_mode: 4,
                    delivery_sum: totalCost,
                    period_min: 2,
                    period_max: 5,
                    services: []
                }],
                total_sum: totalCost,
                currency: 'RUB'
            });
        }

        const calculateUrl = 'https://api.edu.cdek.ru/v2/calculator/tarifflist';
        
        const response = await fetch(calculateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from_location: from_location || { code: 44 }, // Москва по умолчанию
                to_location: to_location,
                packages: packages || [{
                    weight: 500,
                    length: 30,
                    width: 20,
                    height: 5
                }],
                services: []
            })
        });

        if (!response.ok) {
            throw new Error('Failed to calculate delivery');
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Calculate Error:', error);
        res.status(500).json({ error: 'Failed to calculate delivery' });
    }
});

// Create CDEK order
app.post('/api/cdek/order/create', async (req, res) => {
    try {
        const orderData = req.body;
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            // Demo response with realistic data
            return res.json({
                entity: {
                    uuid: 'demo-uuid-' + Date.now(),
                    cdek_number: 'CDEK' + Date.now().toString().slice(-8),
                    number: orderData.number,
                    tariff_code: orderData.tariff_code,
                    statuses: [{
                        code: 'CREATED',
                        name: 'Заказ создан',
                        date_time: new Date().toISOString()
                    }]
                },
                requests: [{
                    request_uuid: 'req-' + Date.now(),
                    type: 'CREATE',
                    state: 'SUCCESSFUL',
                    date_time: new Date().toISOString()
                }]
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
            const errorText = await response.text();
            console.error('Order creation failed:', errorText);
            throw new Error('Failed to create order');
        }

        const orderResponse = await response.json();
        res.json(orderResponse);
    } catch (error) {
        console.error('Order Error:', error);
        res.status(500).json({ 
            error: 'Failed to create order',
            message: error.message
        });
    }
});

// Get order status
app.get('/api/cdek/order/:uuid/status', async (req, res) => {
    try {
        const { uuid } = req.params;
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken || authToken.startsWith('demo-token-')) {
            return res.json({
                entity: {
                    uuid: uuid,
                    status: 'CREATED',
                    statuses: [{
                        code: 'CREATED',
                        name: 'Заказ создан',
                        date_time: new Date().toISOString()
                    }]
                }
            });
        }

        const statusUrl = `https://api.edu.cdek.ru/v2/orders/${uuid}`;
        
        const response = await fetch(statusUrl, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get order status');
        }

        const statusData = await response.json();
        res.json(statusData);
    } catch (error) {
        console.error('Status Error:', error);
        res.status(500).json({ error: 'Failed to get order status' });
    }
});

// Payment initialization
app.post('/api/payment/init', async (req, res) => {
    try {
        const { orderId, amount, customer, items, description } = req.body;
        
        res.json({
            Success: true,
            PaymentURL: null,
            PaymentId: 'demo-' + Date.now(),
            Message: 'Payment initialized (demo mode)',
            OrderId: orderId,
            Amount: amount
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
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        res.json({
            Success: true,
            TransactionId: 'demo-txn-' + Date.now(),
            Amount: amount,
            Message: 'Payment processed successfully (demo)',
            OrderId: orderId
        });
    } catch (error) {
        console.error('Payment Process Error:', error);
        res.status(500).json({ 
            Success: false,
            Message: 'Payment processing failed'
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
            total: order.total,
            delivery: order.delivery?.city?.name
        });
        
        res.json({ 
            success: true, 
            message: 'Notification logged',
            orderId: order.id
        });
    } catch (error) {
        console.error('Notification Error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Send payment notifications
app.post('/api/notify/payment', async (req, res) => {
    try {
        const { orderId, amount, customer } = req.body;
        
        console.log('Payment notification received:', {
            orderId: orderId,
            amount: amount,
            customer: customer?.name
        });
        
        res.json({ 
            success: true, 
            message: 'Payment notification logged',
            orderId: orderId
        });
    } catch (error) {
        console.error('Payment Notification Error:', error);
        res.status(500).json({ error: 'Failed to send payment notification' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`=== Illusive Store Backend ===`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`CDEK API: ${CDEK_API_KEY ? 'Configured' : 'Using demo mode'}`);
    console.log(`================================`);
});
