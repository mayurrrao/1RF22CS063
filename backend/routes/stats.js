const express = require('express');
const router = express.Router();
const logging = require('../middleware/logging');

const urlDB = require('./urlShortener').urlDatabase || new Map();
const statsDB = require('./urlShortener').statsDatabase || new Map();

router.get('/:shortcode/stats', (req, res) => {
    try {
        const { shortcode } = req.params;
        
        logging.logInfo('Stats requested', { shortcode });

        if (!statsDB.has(shortcode)) {
            logging.logWarning('Stats not found', { shortcode });
            return res.status(404).json({
                error: 'Not Found',
                message: 'Statistics not found',
                timestamp: new Date().toISOString()
            });
        }

        const stats = statsDB.get(shortcode);
        const urlData = urlDB.get(shortcode);

        // Basic analytics
        const clicks = stats.clickDetails;
        const hourlyBreakdown = {};
        const dailyBreakdown = {};
        
        clicks.forEach(click => {
            const date = new Date(click.timestamp);
            const hour = date.getHours();
            const day = date.toISOString().split('T')[0];
            
            hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + 1;
            dailyBreakdown[day] = (dailyBreakdown[day] || 0) + 1;
        });

        const now = new Date();
        const created = new Date(stats.createdAt);
        const ageInDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        const avgClicksPerDay = ageInDays > 0 ? (stats.totalClicks / ageInDays).toFixed(2) : stats.totalClicks;
        
        const last24h = clicks.filter(click => 
            new Date(click.timestamp) > new Date(now.getTime() - 24 * 60 * 60 * 1000)
        ).length;

        logging.logInfo('Stats retrieved', { shortcode, totalClicks: stats.totalClicks });

        res.status(200).json({
            shortcode,
            originalUrl: stats.originalUrl,
            createdAt: stats.createdAt,
            totalClicks: stats.totalClicks,
            lastAccessed: stats.lastAccessed,
            isActive: urlData ? urlData.isActive : false,
            expiresAt: urlData ? urlData.expiresAt : null,
            analytics: {
                ageInDays,
                avgClicksPerDay: parseFloat(avgClicksPerDay),
                recentClicks24h: last24h,
                hourlyBreakdown,
                dailyBreakdown
            },
            recentActivity: clicks.slice(-5).map(click => ({
                timestamp: click.timestamp,
                ip: click.ip,
                userAgent: click.userAgent
            })),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logging.logError('Stats retrieval failed', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve statistics',
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/stats/summary', (req, res) => {
    try {
        logging.logInfo('Service summary requested');

        const totalUrls = urlDB.size;
        const totalClicks = Array.from(statsDB.values())
            .reduce((sum, stats) => sum + stats.totalClicks, 0);
        
        const activeUrls = Array.from(urlDB.values())
            .filter(url => url.isActive && new Date(url.expiresAt) > new Date()).length;

        const uptime = process.uptime();

        const summary = {
            service: 'URL Shortener',
            uptime: Math.floor(uptime),
            statistics: {
                totalUrls,
                activeUrls,
                expiredUrls: totalUrls - activeUrls,
                totalClicks,
                avgClicksPerUrl: totalUrls > 0 ? (totalClicks / totalUrls).toFixed(2) : 0
            },
            timestamp: new Date().toISOString()
        };

        logging.logInfo('Service summary retrieved');
        res.status(200).json(summary);

    } catch (error) {
        logging.logError('Service summary failed', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve summary',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;