# Apache2 Virtual Host Configuration Guide

This directory contains the Apache2 virtual host configuration for your CCTV application.

## Files

- `apache-vhost.conf` - Apache2 virtual host template configuration
- `../scripts/setup-apache-vhost.sh` - Automated setup script

## Quick Setup

### 1. Run the Setup Script

```bash
cd /home/yama/CCTV
sudo bash scripts/setup-apache-vhost.sh
```

The script will:
- Enable required Apache modules
- Create the virtual host configuration
- Configure SSL settings for Let's Encrypt
- Set up proper WebSocket support for Socket.IO

### 2. Get SSL Certificate

After setting up the virtual host, obtain your Let's Encrypt certificate:

```bash
sudo certbot --apache -d your-domain.com
```

### 3. Start Your Application

Make sure your CCTV Node.js application is running:

```bash
cd /home/yama/CCTV
npm start
# or with PM2
npm run pm2:start
```

## Configuration Features

### ✅ Prevents "Too Many Redirects" Error
- HTTP to HTTPS redirect only for non-ACME challenge requests
- Proper SSL termination at Apache level
- Clean proxy configuration to Node.js backend

### 🔒 SSL/TLS Security
- Modern SSL protocols (TLS 1.2+)
- Strong cipher suites
- Security headers (HSTS, X-Frame-Options, etc.)

### 🌐 WebSocket Support
- Proper WebSocket proxy for Socket.IO
- Upgrade header handling
- Real-time video streaming support

### 🚀 Performance
- HTTP/2 support (when available)
- Proper caching headers
- Efficient proxy configuration

## Manual Setup (Alternative)

If you prefer manual setup:

### 1. Install Required Packages

```bash
sudo apt update
sudo apt install apache2 certbot python3-certbot-apache
```

### 2. Enable Apache Modules

```bash
sudo a2enmod rewrite ssl proxy proxy_http proxy_wstunnel headers
```

### 3. Copy Configuration

```bash
sudo cp /home/yama/CCTV/config/apache-vhost.conf /etc/apache2/sites-available/your-domain.com.conf
```

### 4. Edit Domain Name

Replace `your-domain.com` with your actual domain in the configuration file:

```bash
sudo sed -i 's/your-domain.com/your-actual-domain.com/g' /etc/apache2/sites-available/your-domain.com.conf
```

### 5. Enable Site

```bash
sudo a2ensite your-domain.com.conf
sudo a2dissite 000-default.conf  # Disable default site
sudo systemctl reload apache2
```

## Troubleshooting

### Common Issues

1. **"Too Many Redirects" Error**
   - Check that your Node.js app is not also doing HTTPS redirects
   - Verify the `X-Forwarded-Proto` header is being set correctly

2. **WebSocket Connection Failed**
   - Ensure `proxy_wstunnel` module is enabled
   - Check that your Node.js app is running on port 3000

3. **SSL Certificate Issues**
   - Run `sudo certbot renew --dry-run` to test renewal
   - Check certificate paths match your domain

### Log Files

Check these log files for debugging:
- `/var/log/apache2/cctv_error.log` - HTTP errors
- `/var/log/apache2/cctv_ssl_error.log` - HTTPS errors
- `/var/log/apache2/cctv_access.log` - HTTP access logs
- `/var/log/apache2/cctv_ssl_access.log` - HTTPS access logs

## Node.js Application Considerations

Make sure your Node.js application is configured to work behind a proxy:

1. **Trust Proxy Headers** (if using Express.js):
   ```javascript
   app.set('trust proxy', true);
   ```

2. **Session Cookie Security**:
   ```javascript
   app.use(session({
       cookie: { 
           secure: true,  // Only send over HTTPS
           httpOnly: true,
           sameSite: 'strict'
       }
   }));
   ```

3. **Port Configuration**:
   - Your app should listen on port 3000 (or update the Apache config)
   - Use `0.0.0.0` as the host for Docker compatibility if needed

## Security Notes

- The configuration includes modern security headers
- HTTPS is enforced for all traffic (except Let's Encrypt challenges)
- WebSocket connections are properly secured
- Strong SSL/TLS configuration is applied

For additional security, consider:
- Setting up fail2ban for Apache
- Configuring a firewall (UFW or iptables)
- Regular security updates for Apache and Let's Encrypt