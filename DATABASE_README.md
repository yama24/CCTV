# CCTV Database System

This document explains the SQLite database system integrated into your CCTV application.

## 🗄️ Database Structure

The system uses SQLite with the following tables:

### **Users Table**
Stores user accounts and authentication information.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| username | TEXT | Unique username |
| password_hash | TEXT | Bcrypt hashed password |
| email | TEXT | User email (optional) |
| full_name | TEXT | User's full name (optional) |
| role | TEXT | User role: 'admin' or 'user' |
| is_active | INTEGER | 1 if active, 0 if deactivated |
| created_at | DATETIME | Account creation timestamp |
| updated_at | DATETIME | Last update timestamp |
| last_login | DATETIME | Last successful login |

### **Sessions Table**
Tracks user sessions for security monitoring.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| session_id | TEXT | Unique session identifier |
| user_id | INTEGER | Foreign key to users table |
| ip_address | TEXT | Client IP address |
| user_agent | TEXT | Client browser/device info |
| created_at | DATETIME | Session start time |
| expires_at | DATETIME | Session expiration time |
| is_active | INTEGER | 1 if active, 0 if expired |

### **Camera Logs Table**
Records camera connection and viewing activities.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| room_id | TEXT | Camera room identifier |
| camera_name | TEXT | Camera display name |
| device_info | TEXT | Device information |
| user_id | INTEGER | Foreign key to users table |
| action | TEXT | Action performed (camera_connected, viewer_connected, etc.) |
| ip_address | TEXT | Client IP address |
| timestamp | DATETIME | When action occurred |
| duration | INTEGER | Session duration in seconds (for disconnections) |

### **Login Attempts Table**
Security log of all login attempts (successful and failed).

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| username | TEXT | Attempted username |
| ip_address | TEXT | Client IP address |
| user_agent | TEXT | Client browser/device info |
| success | INTEGER | 1 if successful, 0 if failed |
| timestamp | DATETIME | Attempt timestamp |
| error_message | TEXT | Error details (for failed attempts) |

### **Settings Table**
Application configuration settings.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| key | TEXT | Setting name |
| value | TEXT | Setting value |
| description | TEXT | Setting description |
| updated_at | DATETIME | Last update timestamp |

## 🚀 Quick Start

### 1. Initialize Database
```bash
# Create initial admin user
node setup-admin.js
```

### 2. Manage Users
```bash
# Interactive user management
node user-manager.js

# Quick commands
node user-manager.js add     # Add user directly
node user-manager.js list    # List all users
```

### 3. Database Maintenance
```bash
# Full maintenance (recommended weekly)
node db-maintenance.js

# Specific operations
node db-maintenance.js report          # Generate statistics
node db-maintenance.js cleanup 30      # Clean logs older than 30 days
node db-maintenance.js sessions        # Clean expired sessions
node db-maintenance.js vacuum          # Optimize database
```

## 👤 User Management

### **Adding Users**
```bash
node user-manager.js
# Select option 1: Add new user
# Follow the prompts to enter user details
```

**User Roles:**
- **admin**: Full access to all cameras and admin features
- **user**: Standard camera access

### **Changing Passwords**
```bash
node user-manager.js
# Select option 3: Change user password
# Enter username and new password
```

### **Deactivating Users**
```bash
node user-manager.js
# Select option 4: Delete (deactivate) user
# User will be deactivated but data preserved
```

## 📊 Monitoring & Security

### **Security Features**

1. **Rate Limiting**: Prevents brute force attacks
   - Max 5 failed login attempts per IP/username in 15 minutes
   - Automatic lockout for repeated failures

2. **Session Management**: Secure session tracking
   - JWT tokens with expiration
   - Session cleanup for expired sessions

3. **Activity Logging**: Complete audit trail
   - All camera connections/disconnections logged
   - Login attempts recorded with IP and user agent
   - Duration tracking for camera sessions

### **Monitoring Commands**

```bash
# View database statistics
node db-maintenance.js report

# Check recent activity
sqlite3 cctv.db "SELECT * FROM camera_logs ORDER BY timestamp DESC LIMIT 10"

# Check failed login attempts
sqlite3 cctv.db "SELECT * FROM login_attempts WHERE success = 0 ORDER BY timestamp DESC LIMIT 10"

# View active sessions
sqlite3 cctv.db "SELECT * FROM sessions WHERE is_active = 1 AND expires_at > datetime('now')"
```

## 🔧 Configuration

### **Default Settings**
The system comes with these default security settings:

| Setting | Value | Description |
|---------|-------|-------------|
| max_login_attempts | 5 | Failed attempts before lockout |
| lockout_duration | 300 | Lockout time in seconds (5 minutes) |
| session_timeout | 86400 | Session duration in seconds (24 hours) |
| max_camera_sessions | 10 | Max concurrent camera sessions |

### **Modifying Settings**
```bash
# Connect to database directly
sqlite3 cctv.db

# Update a setting
UPDATE settings SET value = '10' WHERE key = 'max_login_attempts';

# View all settings
SELECT * FROM settings;
```

## 🗂️ File Locations

- **Database**: `cctv.db` (SQLite file)
- **Management Scripts**: 
  - `user-manager.js` - User account management
  - `setup-admin.js` - Initial admin user creation
  - `db-maintenance.js` - Database maintenance and reports
  - `database.js` - Database class and methods

## 🛡️ Security Best Practices

### **Initial Setup**
1. **Change default password** immediately after setup
2. **Create additional admin users** if needed
3. **Set strong passwords** (minimum 8 characters, mixed case, numbers, symbols)

### **Regular Maintenance**
```bash
# Weekly maintenance (recommended cron job)
0 2 * * 0 cd /path/to/cctv && node db-maintenance.js

# Monthly deep cleanup
0 2 1 * * cd /path/to/cctv && node db-maintenance.js cleanup 90
```

### **Access Control**
```bash
# Secure database file permissions
chmod 600 cctv.db
chown www-data:www-data cctv.db  # If running as www-data
```

## 📚 Advanced Usage

### **Database Queries**

**Most active users:**
```sql
SELECT u.username, COUNT(*) as sessions 
FROM camera_logs cl 
JOIN users u ON cl.user_id = u.id 
WHERE cl.action = 'camera_connected' 
GROUP BY u.username 
ORDER BY sessions DESC;
```

**Failed login attempts by IP:**
```sql
SELECT ip_address, COUNT(*) as attempts 
FROM login_attempts 
WHERE success = 0 
AND timestamp > datetime('now', '-24 hours') 
GROUP BY ip_address 
ORDER BY attempts DESC;
```

**Camera usage statistics:**
```sql
SELECT room_id, camera_name, 
       COUNT(*) as sessions,
       AVG(duration) as avg_duration 
FROM camera_logs 
WHERE action = 'camera_disconnected' 
GROUP BY room_id, camera_name;
```

### **Backup & Restore**

**Backup:**
```bash
# Create backup
cp cctv.db cctv_backup_$(date +%Y%m%d_%H%M%S).db

# Or use SQLite dump
sqlite3 cctv.db .dump > cctv_backup.sql
```

**Restore:**
```bash
# From backup file
cp cctv_backup_20250912_143000.db cctv.db

# From SQL dump
sqlite3 cctv_new.db < cctv_backup.sql
```

## ❓ Troubleshooting

### **Common Issues**

**"Database locked" error:**
```bash
# Check for zombie processes
ps aux | grep node

# Kill if necessary
pkill -f "node server.js"
```

**Permission denied:**
```bash
# Fix file permissions
chmod 644 cctv.db
chown $USER:$USER cctv.db
```

**Corrupted database:**
```bash
# Check database integrity
sqlite3 cctv.db "PRAGMA integrity_check;"

# Repair if needed
sqlite3 cctv.db "PRAGMA vacuum;"
```

Your CCTV system now has a complete, secure database backend! 🎉