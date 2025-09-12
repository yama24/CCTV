const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        const dbPath = path.join(__dirname, 'cctv.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database');
                this.initializeTables();
            }
        });
    }

    initializeTables() {
        // Users table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                full_name TEXT,
                role TEXT DEFAULT 'user',
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('Users table ready');
            }
        });

        // Sessions table for better session management
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating sessions table:', err.message);
            } else {
                console.log('Sessions table ready');
            }
        });

        // Camera logs table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS camera_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                camera_name TEXT,
                device_info TEXT,
                user_id INTEGER,
                action TEXT NOT NULL,
                ip_address TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                duration INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating camera_logs table:', err.message);
            } else {
                console.log('Camera logs table ready');
            }
        });

        // Login attempts table for security monitoring
        this.db.run(`
            CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                ip_address TEXT,
                user_agent TEXT,
                success INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT
            )
        `, (err) => {
            if (err) {
                console.error('Error creating login_attempts table:', err.message);
            } else {
                console.log('Login attempts table ready');
            }
        });

        // Settings table for application configuration
        this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating settings table:', err.message);
            } else {
                console.log('Settings table ready');
                this.insertDefaultSettings();
            }
        });
    }

    insertDefaultSettings() {
        const defaultSettings = [
            {
                key: 'max_login_attempts',
                value: '5',
                description: 'Maximum login attempts before account lockout'
            },
            {
                key: 'lockout_duration',
                value: '300',
                description: 'Account lockout duration in seconds'
            },
            {
                key: 'session_timeout',
                value: '86400',
                description: 'Session timeout in seconds (24 hours)'
            },
            {
                key: 'max_camera_sessions',
                value: '10',
                description: 'Maximum concurrent camera sessions'
            }
        ];

        const insertSetting = this.db.prepare(`
            INSERT OR IGNORE INTO settings (key, value, description) 
            VALUES (?, ?, ?)
        `);

        defaultSettings.forEach(setting => {
            insertSetting.run(setting.key, setting.value, setting.description);
        });

        insertSetting.finalize();
    }

    // User methods
    getUserByUsername(username, callback) {
        this.db.get(
            'SELECT * FROM users WHERE username = ? AND is_active = 1',
            [username],
            callback
        );
    }

    getUserById(userId, callback) {
        this.db.get(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [userId],
            callback
        );
    }

    createUser(userData, callback) {
        const { username, passwordHash, email, fullName, role } = userData;
        this.db.run(
            `INSERT INTO users (username, password_hash, email, full_name, role) 
             VALUES (?, ?, ?, ?, ?)`,
            [username, passwordHash, email, fullName, role || 'user'],
            function(err) {
                callback(err, this ? this.lastID : null);
            }
        );
    }

    updateUserLastLogin(userId, callback) {
        this.db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [userId],
            callback
        );
    }

    // Session methods
    createSession(sessionData, callback) {
        const { sessionId, userId, ipAddress, userAgent, expiresAt } = sessionData;
        this.db.run(
            `INSERT INTO sessions (session_id, user_id, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [sessionId, userId, ipAddress, userAgent, expiresAt],
            callback
        );
    }

    getActiveSession(sessionId, callback) {
        this.db.get(
            `SELECT s.*, u.username, u.role 
             FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.session_id = ? AND s.is_active = 1 AND s.expires_at > CURRENT_TIMESTAMP`,
            [sessionId],
            callback
        );
    }

    deactivateSession(sessionId, callback) {
        this.db.run(
            'UPDATE sessions SET is_active = 0 WHERE session_id = ?',
            [sessionId],
            callback
        );
    }

    // Logging methods
    logCameraActivity(logData, callback) {
        const { roomId, cameraName, deviceInfo, userId, action, ipAddress, duration } = logData;
        this.db.run(
            `INSERT INTO camera_logs (room_id, camera_name, device_info, user_id, action, ip_address, duration)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [roomId, cameraName, deviceInfo, userId, action, ipAddress, duration],
            callback
        );
    }

    logLoginAttempt(attemptData, callback) {
        const { username, ipAddress, userAgent, success, errorMessage } = attemptData;
        this.db.run(
            `INSERT INTO login_attempts (username, ip_address, user_agent, success, error_message)
             VALUES (?, ?, ?, ?, ?)`,
            [username, ipAddress, userAgent, success ? 1 : 0, errorMessage],
            callback
        );
    }

    getRecentLoginAttempts(username, ipAddress, minutes = 15, callback) {
        this.db.all(
            `SELECT * FROM login_attempts 
             WHERE (username = ? OR ip_address = ?) 
             AND timestamp > datetime('now', '-${minutes} minutes')
             ORDER BY timestamp DESC`,
            [username, ipAddress],
            callback
        );
    }

    // Settings methods
    getSetting(key, callback) {
        this.db.get(
            'SELECT value FROM settings WHERE key = ?',
            [key],
            (err, row) => {
                callback(err, row ? row.value : null);
            }
        );
    }

    setSetting(key, value, callback) {
        this.db.run(
            'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
            [value, key],
            callback
        );
    }

    // Cleanup methods
    cleanupExpiredSessions(callback) {
        this.db.run(
            'UPDATE sessions SET is_active = 0 WHERE expires_at < CURRENT_TIMESTAMP',
            callback
        );
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed');
            }
        });
    }
}

module.exports = Database;