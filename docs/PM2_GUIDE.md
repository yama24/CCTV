# PM2 Deployment Guide

This guide shows how to run your CCTV application as a production service using PM2 process manager.

## 🚀 Quick Start

### 1. Install PM2 globally
```bash
npm install -g pm2
```

### 2. Start the application
```bash
npm run pm2:start
```

### 3. Save PM2 configuration (auto-restart on system reboot)
```bash
pm2 startup
pm2 save
```

## 📋 Available Commands

### Basic Operations
```bash
# Start the application
npm run pm2:start

# Stop the application
npm run pm2:stop

# Restart the application
npm run pm2:restart

# Graceful reload (zero downtime)
npm run pm2:reload

# Delete from PM2
npm run pm2:delete
```

### Monitoring & Logs
```bash
# View real-time logs
npm run pm2:logs

# Monitor resources
npm run pm2:monit

# Check status
pm2 status

# View detailed info
pm2 show cctv-app
```

## 🔧 Configuration

The application is configured in `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'cctv-app',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    autorestart: true,
    max_restarts: 10
  }]
};
```

### Key Configuration Options:

- **instances**: Number of app instances (1 for single-core setup)
- **max_memory_restart**: Restart if memory usage exceeds limit
- **autorestart**: Automatically restart on crashes
- **max_restarts**: Maximum restart attempts
- **log files**: Separate logging for debugging

## 🔄 Auto-Start on System Boot

To ensure your CCTV app starts automatically when the system boots:

```bash
# Generate startup script (run once)
pm2 startup

# Save current PM2 processes
pm2 save
```

This will create a system service that starts PM2 and your applications on boot.

## 📊 Monitoring

### Real-time Monitoring
```bash
# Terminal-based monitoring
pm2 monit

# Web-based monitoring (optional)
pm2 web
```

### Log Management
```bash
# View live logs
pm2 logs cctv-app

# View logs with timestamp
pm2 logs cctv-app --timestamp

# Clear logs
pm2 flush cctv-app
```

## 🔧 Advanced Operations

### Environment Management
```bash
# Start with development environment
pm2 start ecosystem.config.js --env development

# Start with production environment (default)
pm2 start ecosystem.config.js --env production
```

### Scaling (if needed in future)
```bash
# Scale to 2 instances
pm2 scale cctv-app 2

# Scale back to 1 instance
pm2 scale cctv-app 1
```

### Memory and CPU Monitoring
```bash
# View resource usage
pm2 status

# Restart if memory usage is high
pm2 restart cctv-app
```

## 🚨 Troubleshooting

### Common Issues:

**App won't start:**
```bash
# Check logs for errors
pm2 logs cctv-app

# Check detailed app info
pm2 show cctv-app

# Restart manually
pm2 restart cctv-app
```

**High memory usage:**
```bash
# Check current usage
pm2 status

# Restart to clear memory
pm2 restart cctv-app
```

**Logs not appearing:**
```bash
# Check log file paths
ls -la logs/

# Verify log configuration in ecosystem.config.js
```

## 🔐 Security Considerations

- PM2 runs as the current user (yama)
- Log files are created with user permissions
- Application uses port 3000 (configure firewall accordingly)
- Database file `cctv.db` should be backed up regularly

## 📱 Access Your CCTV

Once running with PM2:
- **Local access**: `http://localhost:3000`
- **Remote access**: Set up ngrok or configure your router for port forwarding
- **Login**: Use your admin credentials

## 🎯 Production Best Practices

1. **Regular backups**: Backup `cctv.db` and configuration files
2. **Log rotation**: Set up logrotate for PM2 logs
3. **Monitoring**: Use `pm2 monit` to watch resource usage
4. **Updates**: Stop PM2, update code, restart
5. **Security**: Change default passwords, use HTTPS in production

Your CCTV application is now running as a robust, production-ready service! 🎉