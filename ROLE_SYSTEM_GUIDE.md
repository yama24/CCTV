# CCTV Role-Based Access Control (RBAC) System

## 🔐 **Role System Overview**

The CCTV system implements a comprehensive role-based access control system with two main roles:

### **👤 User Role (`user`)**
- **Camera Access**: Can operate cameras and stream video
- **Viewer Access**: Can watch camera feeds from other devices  
- **Basic Features**: Full access to camera and viewer functionality
- **Restrictions**: Cannot access administrative features

### **🛠️ Admin Role (`admin`)**
- **Full Access**: All user capabilities plus administrative functions
- **User Management**: View user accounts and activity logs
- **System Monitoring**: Access to statistics and system health
- **Security Oversight**: View failed login attempts and security logs
- **Configuration**: Modify system settings (future feature)

---

## 🎯 **What Each Role Can Do**

### **Regular Users (`user`)**

**✅ Allowed:**
- 📹 **Start/Stop Camera**: Stream their device as a camera
- 👁️ **View Cameras**: Watch live feeds from available cameras  
- 🔧 **Device Settings**: Configure camera name, select video/audio devices
- 🔐 **Change Password**: Modify their own password
- 📱 **WebRTC Features**: Full peer-to-peer streaming capabilities

**❌ Restricted:**
- 🚫 **Admin Dashboard**: Cannot access `/admin` routes
- 🚫 **User Management**: Cannot see other users' information  
- 🚫 **Activity Logs**: Cannot view system-wide activity logs
- 🚫 **System Statistics**: Cannot access usage statistics
- 🚫 **Security Logs**: Cannot view failed login attempts

### **Administrators (`admin`)**

**✅ Full Access:**
- 🌟 **Everything Users Can Do**: Complete camera and viewer functionality
- 👥 **User Management**: View all user accounts, roles, and activity
- 📊 **Activity Monitoring**: Complete audit trail of all camera sessions
- 📈 **System Statistics**: Usage metrics, login statistics, performance data
- 🔒 **Security Monitoring**: Failed login attempts, IP tracking, security alerts  
- ⚙️ **Admin Dashboard**: Dedicated administrative interface
- 🛡️ **System Health**: Database statistics, cleanup operations

---

## 🌐 **Role-Based Navigation**

### **Navigation Bar Features:**

**All Users See:**
- 📹 **Camera** - Stream your device
- 👁️ **Viewer** - Watch camera feeds  
- 🚪 **Logout** - Sign out securely

**Admins Additionally See:**
- ⚙️ **Admin** - Administrative dashboard

### **User Information Display:**
- Shows current username and role badge
- **Green badge** for regular users
- **Red badge** for administrators

---

## 🔗 **Admin-Only Routes & APIs**

### **Web Interface:**
- `/admin` - Main admin dashboard
- `/admin/users` - User management interface
- `/admin/logs` - Activity logs viewer
- `/admin/stats` - System statistics dashboard

### **API Endpoints:**
- `GET /api/admin/users` - List all users with details
- `GET /api/admin/logs` - Get activity logs with pagination
- `GET /api/admin/stats` - Comprehensive system statistics
- All return **403 Forbidden** for non-admin users

---

## 📊 **Admin Dashboard Features**

### **👥 User Management (`/admin/users`)**
```
Displays comprehensive user table:
- User ID, username, email, full name
- Role badges (ADMIN/USER)  
- Account status (Active/Inactive)
- Creation date and last login time
- Direct links to user management tools
```

### **📋 Activity Logs (`/admin/logs`)**
```
Real-time activity monitoring:
- Camera connections/disconnections
- Viewer sessions with duration
- User authentication events
- IP address tracking
- Session duration analysis
```

### **📈 Statistics Dashboard (`/admin/stats`)**
```
System metrics at a glance:
- Active user count
- 24-hour activity summary  
- Failed login attempt monitoring
- Most popular cameras ranking
- Database health indicators
```

---

## 🛡️ **Security Implementation**

### **Access Control Mechanisms:**

1. **Route Protection**: Middleware checks user role before page access
2. **API Security**: All admin endpoints validate role in JWT token
3. **Session Validation**: Role stored in session and continuously verified
4. **UI Adaptation**: Interface changes based on user permissions
5. **Error Handling**: Graceful 403 errors for unauthorized access

### **Example Access Control:**
```javascript
// Only admins can access user management
app.get('/admin/users', requireAdmin, (req, res) => {
    // Admin-only functionality
});

// API with role validation
app.get('/api/admin/stats', requireApiAuth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    // Return admin data
});
```

---

## 👨‍💼 **User Management**

### **Creating Users with Roles:**

**Using Interactive Script:**
```bash
node user-manager.js
# Select "1. Add new user"
# Choose role: admin or user
```

**Role Assignment Guidelines:**
- **Assign `admin` role to**: IT administrators, security managers, system operators
- **Assign `user` role to**: Family members, regular users, camera operators
- **Principle of least privilege**: Give minimum required permissions

### **Current Test Users:**

| Username | Role | Password | Purpose |
|----------|------|----------|---------|
| `admin` | admin | `password` | System administrator |
| `user1` | user | `password123` | Regular user example |
| `user2` | user | `password123` | Another regular user |
| `moderator` | admin | `moderator123` | Additional admin |

⚠️ **Change all default passwords immediately in production!**

---

## 🔄 **Role Switching & Testing**

### **Test Different Roles:**

1. **Login as Admin** (`admin` / `password`):
   - See admin dashboard link in navigation
   - Access all administrative features
   - View complete system statistics

2. **Login as Regular User** (`user1` / `password123`):
   - Only see camera and viewer links
   - Cannot access admin routes
   - Get 403 error if trying to access admin APIs

### **Live Role Validation:**
```bash
# Test admin access
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:3000/api/admin/stats

# Test user access (should fail)  
curl -H "Authorization: Bearer YOUR_USER_TOKEN" http://localhost:3000/api/admin/stats
```

---

## 🚀 **Future Role Enhancements**

### **Planned Features:**
- 📹 **Camera Ownership**: Users can only manage their own cameras
- 🏠 **Room-Based Access**: Restrict access to specific camera rooms
- ⏰ **Time-Based Access**: Schedule when users can access cameras
- 📱 **Device Limits**: Restrict number of simultaneous connections per user
- 🔔 **Notifications**: Role-based alert system
- 📊 **Custom Dashboards**: Personalized interfaces per role

### **Advanced Role Types (Future):**
- **`viewer`**: Can only watch cameras, cannot stream
- **`operator`**: Can manage cameras but not access admin features  
- **`manager`**: Limited admin access without user management
- **`guest`**: Temporary limited access with expiration

---

## 🎯 **Best Practices**

### **Security Recommendations:**
1. **Regular Audits**: Review user roles quarterly
2. **Access Logs**: Monitor admin dashboard usage
3. **Password Policy**: Enforce strong passwords for all roles
4. **Role Separation**: Don't give admin access unnecessarily  
5. **Session Management**: Regular cleanup of inactive sessions

### **Operational Guidelines:**
1. **Admin Accounts**: Create separate admin accounts, don't elevate regular users
2. **Backup Admins**: Ensure multiple people have admin access
3. **Documentation**: Keep record of who has what role and why
4. **Training**: Ensure admins understand their responsibilities
5. **Monitoring**: Set up alerts for suspicious admin activity

---

## ❓ **Troubleshooting Roles**

### **Common Issues:**

**"Access Denied" Error:**
- Check user role: `SELECT username, role FROM users WHERE username = 'your_user';`
- Verify session: Clear browser cookies and re-login
- Check token: Role information stored in JWT token

**Admin Navigation Not Showing:**
- Verify JavaScript loaded user info correctly
- Check browser console for errors
- Ensure user has `admin` role in database

**Database Role Issues:**
```sql
-- Check user roles
SELECT username, role, is_active FROM users;

-- Update user role
UPDATE users SET role = 'admin' WHERE username = 'your_user';

-- Activate user account  
UPDATE users SET is_active = 1 WHERE username = 'your_user';
```

The role system provides **comprehensive security** while maintaining **ease of use** for both regular users and administrators! 🎉