const fs = require('fs');
const path = require('path');

class Logging {
    constructor() {
        this.logPath = path.join(__dirname, '../logs');
        this.accessToken = process.env.ACCESS_TOKEN;
        this.testUrl = 'http://20.244.56.144/evaluation-service/logs';
        this.ensureLogDir();
        this.packages = ['auth', 'cache', 'config', 'controller', 'db', 'middleware', 'model', 'route', 'service', 'utils'];
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }
    }

    getPackage(msg) {
        if (msg.includes('auth')) return 'auth';
        if (msg.includes('middleware')) return 'middleware';
        if (msg.includes('route')) return 'route';
        if (msg.includes('controller')) return 'controller';
        if (msg.includes('service')) return 'service';
        return 'service';
    }

    formatLog(data) {
        return {
            timestamp: new Date().toISOString(),
            level: data.level || 'info',
            message: data.message,
            stack: 'backend',
            package: this.getPackage(data.message.toLowerCase()),
            ...data
        };
    }

    writeLog(entry) {
        const file = `app-${new Date().toISOString().split('T')[0]}.log`;
        const logPath = path.join(this.logPath, file);
        try {
            fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
        } catch (err) {
            console.error('Log write failed:', err);
        }
    }

    async sendToServer(entry) {
        if (!this.accessToken) return;
        
        try {
            const fetch = require('node-fetch');
            await fetch(this.testUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({
                    stack: 'backend',
                    level: entry.level,
                    package: entry.package,
                    message: entry.message
                })
            });
        } catch (err) {
            console.error('Server send failed:', err.message);
        }
    }

    logAPICall() {
        return (req, res, next) => {
            const start = Date.now();
            const id = `req_${Date.now()}`;
            
            const reqLog = this.formatLog({
                level: 'info',
                message: `${req.method} ${req.url} - Request received`,
                method: req.method,
                url: req.url,
                ip: req.ip
            });

            this.writeLog(reqLog);
            this.sendToServer(reqLog);
            console.log('Request:', req.method, req.url);

            res.on('finish', () => {
                const time = Date.now() - start;
                const resLog = this.formatLog({
                    level: res.statusCode >= 400 ? 'error' : 'info',
                    message: `${req.method} ${req.url} - ${res.statusCode} in ${time}ms`,
                    responseStatus: res.statusCode,
                    responseTime: `${time}ms`
                });

                this.writeLog(resLog);
                this.sendToServer(resLog);
                console.log('Response:', res.statusCode, `${time}ms`);
            });

            next();
        };
    }

    logInfo(msg, data = {}) {
        const entry = this.formatLog({ level: 'info', message: msg, ...data });
        this.writeLog(entry);
        this.sendToServer(entry);
        console.log('INFO:', msg);
    }

    logError(msg, err = null, data = {}) {
        const entry = this.formatLog({
            level: 'error',
            message: msg,
            error: err ? { message: err.message, stack: err.stack } : null,
            ...data
        });
        this.writeLog(entry);
        this.sendToServer(entry);
        console.error('ERROR:', msg, err?.message);
    }

    logWarning(msg, data = {}) {
        const entry = this.formatLog({ level: 'warn', message: msg, ...data });
        this.writeLog(entry);
        this.sendToServer(entry);
        console.warn('WARN:', msg);
    }

    async testServerConnection() {
        if (!this.accessToken) return false;

        try {
            const fetch = require('node-fetch');
            const res = await fetch(this.testUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({
                    stack: 'backend',
                    level: 'info',
                    package: 'middleware',
                    message: 'Test connection'
                })
            });
            return res.ok;
        } catch (err) {
            return false;
        }
    }
}

module.exports = new Logging();