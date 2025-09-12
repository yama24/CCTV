#!/usr/bin/env node

// Database maintenance and cleanup script
const Database = require('./database');

class DatabaseMaintenance {
    constructor() {
        this.db = new Database();
    }

    async cleanupExpiredSessions() {
        console.log('🧹 Cleaning up expired sessions...');
        
        return new Promise((resolve, reject) => {
            this.db.cleanupExpiredSessions((err) => {
                if (err) {
                    console.error('❌ Error cleaning sessions:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Expired sessions cleaned up');
                    resolve();
                }
            });
        });
    }

    async cleanupOldLogs(days = 30) {
        console.log(`🧹 Cleaning up logs older than ${days} days...`);
        
        const promises = [
            // Clean old camera logs
            new Promise((resolve, reject) => {
                this.db.db.run(
                    `DELETE FROM camera_logs WHERE timestamp < datetime('now', '-${days} days')`,
                    function(err) {
                        if (err) reject(err);
                        else {
                            console.log(`✅ Removed ${this.changes} old camera log entries`);
                            resolve();
                        }
                    }
                );
            }),
            
            // Clean old login attempts
            new Promise((resolve, reject) => {
                this.db.db.run(
                    `DELETE FROM login_attempts WHERE timestamp < datetime('now', '-${days} days')`,
                    function(err) {
                        if (err) reject(err);
                        else {
                            console.log(`✅ Removed ${this.changes} old login attempt entries`);
                            resolve();
                        }
                    }
                );
            })
        ];

        try {
            await Promise.all(promises);
        } catch (error) {
            console.error('❌ Error cleaning logs:', error.message);
            throw error;
        }
    }

    async generateReport() {
        console.log('📊 Generating database report...\n');
        
        try {
            // User statistics
            const userStats = await new Promise((resolve, reject) => {
                this.db.db.get(
                    `SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
                     FROM users`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            console.log('👥 User Statistics:');
            console.log(`   Total Users: ${userStats.total}`);
            console.log(`   Active Users: ${userStats.active}`);
            console.log(`   Administrators: ${userStats.admins}`);
            console.log();

            // Session statistics
            const sessionStats = await new Promise((resolve, reject) => {
                this.db.db.get(
                    `SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN is_active = 1 AND expires_at > datetime('now') THEN 1 ELSE 0 END) as active
                     FROM sessions`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            console.log('🔐 Session Statistics:');
            console.log(`   Total Sessions: ${sessionStats.total}`);
            console.log(`   Active Sessions: ${sessionStats.active}`);
            console.log();

            // Recent login attempts
            const recentLogins = await new Promise((resolve, reject) => {
                this.db.db.get(
                    `SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
                     FROM login_attempts 
                     WHERE timestamp > datetime('now', '-24 hours')`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            console.log('📈 Login Attempts (Last 24h):');
            console.log(`   Total Attempts: ${recentLogins.total}`);
            console.log(`   Successful: ${recentLogins.successful}`);
            console.log(`   Failed: ${recentLogins.failed}`);
            console.log();

            // Camera activity
            const cameraStats = await new Promise((resolve, reject) => {
                this.db.db.get(
                    `SELECT 
                        COUNT(*) as total_sessions,
                        COUNT(DISTINCT room_id) as unique_cameras,
                        AVG(duration) as avg_duration
                     FROM camera_logs 
                     WHERE action = 'camera_disconnected' 
                     AND timestamp > datetime('now', '-7 days')`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            console.log('📹 Camera Activity (Last 7 days):');
            console.log(`   Total Sessions: ${cameraStats.total_sessions}`);
            console.log(`   Unique Cameras: ${cameraStats.unique_cameras}`);
            console.log(`   Average Duration: ${cameraStats.avg_duration ? Math.round(cameraStats.avg_duration) : 0} seconds`);
            console.log();

            // Database size
            const dbStats = await new Promise((resolve, reject) => {
                this.db.db.get(
                    `SELECT 
                        (SELECT COUNT(*) FROM users) as users,
                        (SELECT COUNT(*) FROM sessions) as sessions,
                        (SELECT COUNT(*) FROM camera_logs) as camera_logs,
                        (SELECT COUNT(*) FROM login_attempts) as login_attempts,
                        (SELECT COUNT(*) FROM settings) as settings`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            console.log('💾 Database Records:');
            console.log(`   Users: ${dbStats.users}`);
            console.log(`   Sessions: ${dbStats.sessions}`);
            console.log(`   Camera Logs: ${dbStats.camera_logs}`);
            console.log(`   Login Attempts: ${dbStats.login_attempts}`);
            console.log(`   Settings: ${dbStats.settings}`);

        } catch (error) {
            console.error('❌ Error generating report:', error.message);
            throw error;
        }
    }

    async vacuum() {
        console.log('🧹 Running database VACUUM...');
        
        return new Promise((resolve, reject) => {
            this.db.db.run('VACUUM', (err) => {
                if (err) {
                    console.error('❌ Error running VACUUM:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Database VACUUM completed');
                    resolve();
                }
            });
        });
    }

    async runMaintenance() {
        console.log('🔧 Starting database maintenance...\n');
        
        try {
            await this.cleanupExpiredSessions();
            await this.cleanupOldLogs(30); // Clean logs older than 30 days
            await this.vacuum();
            await this.generateReport();
            
            console.log('\n✅ Database maintenance completed successfully!');
        } catch (error) {
            console.error('\n❌ Database maintenance failed:', error.message);
        } finally {
            this.db.close();
        }
    }
}

// Command line interface
const args = process.argv.slice(2);
const maintenance = new DatabaseMaintenance();

if (args.length === 0) {
    // Run full maintenance
    maintenance.runMaintenance();
} else {
    switch (args[0]) {
        case 'cleanup':
            const days = args[1] ? parseInt(args[1]) : 30;
            maintenance.cleanupOldLogs(days).then(() => {
                maintenance.db.close();
            }).catch(() => {
                maintenance.db.close();
            });
            break;
            
        case 'sessions':
            maintenance.cleanupExpiredSessions().then(() => {
                maintenance.db.close();
            }).catch(() => {
                maintenance.db.close();
            });
            break;
            
        case 'report':
            maintenance.generateReport().then(() => {
                maintenance.db.close();
            }).catch(() => {
                maintenance.db.close();
            });
            break;
            
        case 'vacuum':
            maintenance.vacuum().then(() => {
                maintenance.db.close();
            }).catch(() => {
                maintenance.db.close();
            });
            break;
            
        default:
            console.log('Usage: node db-maintenance.js [cleanup|sessions|report|vacuum] [days]');
            console.log('  cleanup [days]  - Clean logs older than X days (default: 30)');
            console.log('  sessions        - Clean expired sessions');
            console.log('  report          - Generate database report');
            console.log('  vacuum          - Run database VACUUM');
            console.log('  (no args)       - Run full maintenance');
            maintenance.db.close();
    }
}