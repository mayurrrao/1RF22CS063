const express = require('express');
const router = express.Router();
const validator = require('validator');
const logging = require('../middleware/logging');

const urlDB = new Map();
const statsDB = new Map();

function generateCode(custom = null) {
    if (custom) {
        if (urlDB.has(custom)) throw new Error('Custom shortcode already exists');
        return custom;
    }
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (urlDB.has(code));
    return code;
}

router.post('/', (req, res) => {
    try {
        const { url, validity = 30, shortcode } = req.body;

        if (!url) {
            logging.logWarning('Missing URL in request');
            return res.status(400).json({
                error: 'Bad Request',
                message: 'URL is required',
                timestamp: new Date().toISOString()
            });
        }

        if (!validator.isURL(url, { require_protocol: true })) {
            logging.logWarning('Invalid URL format', { url });
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid URL format',
                timestamp: new Date().toISOString()
            });
        }

        if (validity <= 0) {
            logging.logWarning('Invalid validity period');
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Validity must be positive',
                timestamp: new Date().toISOString()
            });
        }

        const code = generateCode(shortcode);
        const expires = new Date(Date.now() + validity * 60000);

        urlDB.set(code, {
            originalUrl: url,
            shortcode: code,
            createdAt: new Date().toISOString(),
            expiresAt: expires.toISOString(),
            isActive: true
        });

        statsDB.set(code, {
            shortcode: code,
            originalUrl: url,
            createdAt: new Date().toISOString(),
            totalClicks: 0,
            clickDetails: [],
            lastAccessed: null
        });

        logging.logInfo('URL shortened', { shortcode: code, url });

        res.status(201).json({
            shortLink: `http://${req.get('host')}/shorturls/${code}`,
            expiry: expires.toISOString()
        });

    } catch (error) {
        logging.logError('URL shortening failed', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create short URL',
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/:shortcode', (req, res) => {
    try {
        const { shortcode } = req.params;
        
        logging.logInfo('URL access requested', { shortcode });

        if (!urlDB.has(shortcode)) {
            logging.logWarning('Shortcode not found', { shortcode });
            return res.status(404).json({
                error: 'Not Found',
                message: 'Short URL not found',
                timestamp: new Date().toISOString()
            });
        }

        const data = urlDB.get(shortcode);
        
        if (new Date() > new Date(data.expiresAt) || !data.isActive) {
            logging.logWarning('URL expired or inactive', { shortcode });
            return res.status(410).json({
                error: 'Gone',
                message: 'Short URL has expired',
                timestamp: new Date().toISOString()
            });
        }

        if (statsDB.has(shortcode)) {
            const stats = statsDB.get(shortcode);
            stats.totalClicks++;
            stats.lastAccessed = new Date().toISOString();
            stats.clickDetails.push({
                timestamp: new Date().toISOString(),
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            statsDB.set(shortcode, stats);
        }

        logging.logInfo('URL accessed', { shortcode, url: data.originalUrl });
        res.redirect(301, data.originalUrl);

    } catch (error) {
        logging.logError('URL access failed', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve URL',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
module.exports.urlDatabase = urlDB;
module.exports.statsDatabase = statsDB;