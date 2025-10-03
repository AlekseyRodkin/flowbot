// src/admin/server.js
// Простой веб-сервер для админ-панели FlowBot

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// Supabase клиент
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Базовая аутентификация
const adminAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (!auth || auth !== `Bearer ${adminPassword}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};
// API Routes

// Получить общую статистику
app.get('/api/stats/overview', adminAuth, async (req, res) => {
    try {
        // Общее количество пользователей
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        // Активные пользователи (за последние 7 дней)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: activeUsers } = await supabase
            .from('daily_stats')
            .select('*', { count: 'exact', head: true })
            .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

        // Платные подписки
        const { count: paidUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .neq('subscription_type', 'free');

        res.json({
            totalUsers,
            activeUsers,
            paidUsers,
            revenue: paidUsers * 499
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// API Routes

// Получить общую статистику
app.get('/api/stats/overview', adminAuth, async (req, res) => {
    try {
        // Общее количество пользователей
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        // Активные пользователи (за последние 7 дней)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: activeUsers } = await supabase
            .from('daily_stats')
            .select('*', { count: 'exact', head: true })
            .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

        // Платные подписки
        const { count: paidUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .neq('subscription_type', 'free');

        res.json({
            totalUsers,
            activeUsers,
            paidUsers,
            revenue: paidUsers * 499
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});