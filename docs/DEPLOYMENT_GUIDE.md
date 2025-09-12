# CCTV System Deployment Guide

This guide explains how to deploy your CCTV system behind Apache2 or Nginx as a reverse proxy with SSL/TLS encryption.

## 🔧 Prerequisites

1. **Domain name** pointing to your server's IP address
2. **SSL certificate** (Let's Encrypt recommended)
3. **Web server** (Apache2 or Nginx)
4. **Node.js application** running on port 3000

## 🌐 Apache2 Deployment

### 1. Install Required Modules
```bash
sudo a2enmod ssl
sudo a2enmod headers
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
```

### 2. Install SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d cctv.yourdomain.com
```

### 3. Configure Virtual Host
```bash
# Copy the Apache configuration
sudo cp config/apache2-vhost.conf /etc/apache2/sites-available/cctv.conf

# Edit the configuration file
sudo nano /etc/apache2/sites-available/cctv.conf
# Replace 'cctv.yourdomain.com' with your actual domain
# Update SSL certificate paths if using custom certificates
```

### 4. Enable Site and Restart
```bash
sudo a2ensite cctv.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

## 🚀 Nginx Deployment

### 1. Install SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d cctv.yourdomain.com
```

### 2. Configure Virtual Host
```bash
# Copy the Nginx configuration
sudo cp config/nginx-vhost.conf /etc/nginx/sites-available/cctv

# Edit the configuration file
sudo nano /etc/nginx/sites-available/cctv
# Replace 'cctv.yourdomain.com' with your actual domain
# Update SSL certificate paths if using custom certificates
```

### 3. Enable Site and Restart
```bash
sudo ln -s /etc/nginx/sites-available/cctv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📦 Node.js Application Setup

### 1. Create Systemd Service
```bash
sudo nano /etc/systemd/system/cctv.service
```

Add the following content:
```ini
[Unit]
Description=CCTV Node.js Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/cctv
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### 2. Deploy Application
```bash
# Create application directory
sudo mkdir -p /var/www/cctv
sudo chown www-data:www-data /var/www/cctv

# Copy your application files
sudo cp -r /home/yama/CCTV/* /var/www/cctv/
sudo chown -R www-data:www-data /var/www/cctv

# Install dependencies
cd /var/www/cctv
sudo -u www-data npm install --production
```

### 3. Start and Enable Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable cctv.service
sudo systemctl start cctv.service
sudo systemctl status cctv.service
```

## 🔒 Security Configurations

### 1. Firewall Setup (UFW)
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. Fail2Ban for Additional Security
```bash
sudo apt install fail2ban

# Create custom filter for your app
sudo nano /etc/fail2ban/filter.d/cctv.conf
```

Add filter content:
```ini
[Definition]
failregex = Authentication failed.*<HOST>
ignoreregex =
```

Create jail configuration:
```bash
sudo nano /etc/fail2ban/jail.d/cctv.conf
```

Add jail content:
```ini
[cctv]
enabled = true
port = http,https
filter = cctv
logpath = /var/log/nginx/cctv_access.log
maxretry = 3
bantime = 3600
findtime = 600
```

### 3. Environment Variables
```bash
# Create environment file
sudo nano /var/www/cctv/.env
```

Add production configuration:
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-very-long-random-secret-key-here
SESSION_SECRET=another-very-long-random-secret-key-here
```

Update your Node.js application to load from environment:
```javascript
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';
const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 24 * 60 * 60 * 1000 
    }
}));
```

## 📊 Monitoring and Logging

### 1. Log Rotation
```bash
sudo nano /etc/logrotate.d/cctv
```

Add log rotation configuration:
```
/var/log/nginx/cctv_*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data adm
    postrotate
        systemctl reload nginx
    endscript
}
```

### 2. Application Monitoring
```bash
# Check application status
sudo systemctl status cctv.service

# View logs
sudo journalctl -u cctv.service -f

# Check web server logs
sudo tail -f /var/log/nginx/cctv_access.log
sudo tail -f /var/log/nginx/cctv_error.log
```

## 🌍 DNS Configuration

Set up your DNS records:

```
Type    Name                    Value
A       cctv.yourdomain.com     YOUR_SERVER_IP
A       www.cctv.yourdomain.com YOUR_SERVER_IP
```

## 🔍 Testing Deployment

1. **SSL Test**: https://www.ssllabs.com/ssltest/
2. **Security Headers**: https://securityheaders.com/
3. **Application Test**: Access https://cctv.yourdomain.com

## 🚨 Troubleshooting

### Common Issues:

1. **502 Bad Gateway**: Node.js application not running
   ```bash
   sudo systemctl status cctv.service
   sudo systemctl restart cctv.service
   ```

2. **WebSocket Connection Failed**: Proxy configuration issue
   - Check proxy_pass configuration
   - Verify Upgrade headers are set

3. **SSL Certificate Issues**:
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

4. **Permission Errors**:
   ```bash
   sudo chown -R www-data:www-data /var/www/cctv
   sudo chmod -R 755 /var/www/cctv
   ```

## 📚 Additional Security Recommendations

1. **Regular Updates**: Keep system packages updated
2. **Backup Strategy**: Regular backups of configuration and data
3. **Access Control**: Use VPN or IP whitelisting for admin access
4. **Monitoring**: Set up log monitoring and alerting
5. **Intrusion Detection**: Consider OSSEC or similar IDS

Your CCTV system is now production-ready with enterprise-grade security! 🎉