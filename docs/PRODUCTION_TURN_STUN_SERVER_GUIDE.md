# 🚀 Production TURN/STUN Server Setup Guide

## 📋 Overview

This guide covers setting up a production-ready TURN/STUN server for WebRTC applications like your CCTV system. A production setup requires security, monitoring, scalability, and reliability considerations beyond basic functionality.

## 🏗️ Architecture Options

### **Option 1: Coturn (Recommended)**
- ✅ Mature and stable
- ✅ Supports both STUN and TURN
- ✅ Good performance
- ✅ Active community support

### **Option 2: Self-hosted Alternatives**
- **OpenRelay** - Simple but limited
- **Pion TURN** - Go-based, modern
- **RTPProxy** - High performance but complex

## 🔧 Production Setup Steps

### **1. Server Requirements**

#### **Minimum Hardware:**
```bash
# CPU: 2 cores minimum, 4+ recommended
# RAM: 2GB minimum, 4GB+ recommended
# Storage: 20GB minimum
# Network: 100Mbps minimum, 1Gbps recommended
```

#### **Recommended Cloud Instances:**
- **AWS**: t3.medium or t3.large
- **DigitalOcean**: 2GB or 4GB droplet
- **Linode**: Linode 4GB or 8GB
- **Vultr**: 2GB or 4GB instance

### **2. Domain and DNS Setup**

#### **Get a Domain:**
```bash
# Register a domain (e.g., turn.yourdomain.com)
# Point A record to your server IP
turn.yourdomain.com A YOUR_SERVER_IP
```

#### **SSL Certificate:**
```bash
# Install Certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d turn.yourdomain.com

# Certificate files location:
/etc/letsencrypt/live/turn.yourdomain.com/
├── cert.pem
├── chain.pem
├── fullchain.pem
└── privkey.pem
```

### **3. Security-First Installation**

#### **Create Dedicated User:**
```bash
# Create turnserver user
sudo useradd -r -s /bin/false turnserver

# Create directories with proper permissions
sudo mkdir -p /etc/turnserver
sudo mkdir -p /var/log/turnserver
sudo mkdir -p /var/lib/turnserver

# Set ownership
sudo chown turnserver:turnserver /var/log/turnserver
sudo chown turnserver:turnserver /var/lib/turnserver
```

#### **Install Coturn:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y coturn sqlite3 libevent-dev libssl-dev

# Verify installation
turnserver --version
```

### **4. Production Configuration**

#### **Main Configuration File:**
```bash
sudo tee /etc/turnserver/turnserver.conf > /dev/null << 'EOF'
# Production TURN/STUN Server Configuration

# Listening configuration
listening-ip=0.0.0.0
listening-port=3478
tls-listening-port=5349
alt-listening-port=3479
alt-tls-listening-port=5350

# External IP (CRITICAL for production)
external-ip=YOUR_PUBLIC_IP_ADDRESS

# SSL/TLS Configuration
cert=/etc/letsencrypt/live/turn.yourdomain.com/cert.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
pkey-pwd=YOUR_PRIVATE_KEY_PASSWORD_IF_ENCRYPTED

# Authentication
lt-cred-mech
use-auth-secret
static-auth-secret=YOUR_STRONG_SECRET_KEY_HERE

# Realm and users
realm=turn.yourdomain.com
userdb=/var/lib/turnserver/turnusers.txt

# Security settings
no-stdout-log
syslog
log-file=/var/log/turnserver/turnserver.log
simple-log

# Performance settings
max-allocate-timeout=3600
allocation-default-timeout=3600
max-allocate-lifetime=3600
channel-lifetime=600
permission-lifetime=300

# Resource limits
total-quota=100
user-quota=10
max-bps-capacity=0

# Database settings
sqlite-userdb=/var/lib/turnserver/turndb.sqlite

# Additional security
no-multicast-peers
no-cli
no-tcp-relay
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.0.2.0-192.0.2.255
denied-peer-ip=192.88.99.0-192.88.99.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=198.51.100.0-198.51.100.255
denied-peer-ip=203.0.113.0-203.0.113.255
denied-peer-ip=240.0.0.0-255.255.255.255

# Monitoring
prometheus
EOF
```

#### **Generate Strong Secret:**
```bash
# Generate a strong random secret
openssl rand -hex 32
# Example output: a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

#### **Create User Database:**
```bash
sudo tee /var/lib/turnserver/turnusers.txt > /dev/null << 'EOF'
# TURN server users (username:password format)
# Generate passwords with: echo -n "password" | openssl dgst -sha256 -hmac "secret"
your-app-user:generated_password_hash_here
EOF
```

### **5. Firewall Configuration**

#### **UFW Setup:**
```bash
# Enable UFW
sudo ufw enable

# Allow SSH (change port if needed)
sudo ufw allow ssh

# Allow TURN ports
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 3479/tcp
sudo ufw allow 3479/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 5350/tcp
sudo ufw allow 5350/udp

# Allow HTTP/HTTPS for Let's Encrypt
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Reload firewall
sudo ufw reload

# Check status
sudo ufw status
```

### **6. Systemd Service Configuration**

#### **Create Custom Service File:**
```bash
sudo tee /etc/systemd/system/coturn.service > /dev/null << 'EOF'
[Unit]
Description=coTURN STUN/TURN Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=turnserver
Group=turnserver
ExecStart=/usr/bin/turnserver -c /etc/turnserver/turnserver.conf
Restart=always
RestartSec=5
LimitNOFILE=1048576

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
ReadWritePaths=/var/log/turnserver /var/lib/turnserver
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Resource limits
MemoryLimit=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF
```

#### **Start and Enable Service:**
```bash
# Reload systemd
sudo systemctl daemon-reload

# Start service
sudo systemctl start coturn

# Enable auto-start
sudo systemctl enable coturn

# Check status
sudo systemctl status coturn
```

### **7. SSL Certificate Automation**

#### **Create Certificate Renewal Script:**
```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/turnserver-reload.sh > /dev/null << 'EOF'
#!/bin/bash
# Reload TURN server after certificate renewal

# Test certificate renewal
certbot renew --dry-run

# If successful, reload TURN server
if [ $? -eq 0 ]; then
    sudo systemctl reload coturn
    echo "$(date): TURN server reloaded after certificate renewal" >> /var/log/turnserver/cert-renewal.log
else
    echo "$(date): Certificate renewal failed" >> /var/log/turnserver/cert-renewal.log
fi
EOF

# Make executable
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/turnserver-reload.sh
```

#### **Test Certificate Renewal:**
```bash
# Test renewal
sudo certbot renew --dry-run

# Check certificate validity
sudo certbot certificates
```

### **8. Monitoring and Logging**

#### **Log Rotation:**
```bash
sudo tee /etc/logrotate.d/turnserver > /dev/null << 'EOF'
/var/log/turnserver/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 turnserver turnserver
    postrotate
        systemctl reload coturn
    endscript
}
EOF
```

#### **Monitoring Script:**
```bash
sudo tee /usr/local/bin/monitor-turnserver.sh > /dev/null << 'EOF'
#!/bin/bash
# TURN Server Monitoring Script

LOG_FILE="/var/log/turnserver/monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check if service is running
if systemctl is-active --quiet coturn; then
    STATUS="RUNNING"
else
    STATUS="STOPPED"
    echo "$TIMESTAMP: ALERT - TURN server is $STATUS" >> $LOG_FILE
    exit 1
fi

# Check port availability
if nc -z localhost 3478 2>/dev/null; then
    PORT_STATUS="OPEN"
else
    PORT_STATUS="CLOSED"
    echo "$TIMESTAMP: ALERT - TURN port 3478 is $PORT_STATUS" >> $LOG_FILE
fi

# Check SSL port
if nc -z localhost 5349 2>/dev/null; then
    SSL_PORT_STATUS="OPEN"
else
    SSL_PORT_STATUS="CLOSED"
    echo "$TIMESTAMP: ALERT - TURN SSL port 5349 is $SSL_PORT_STATUS" >> $LOG_FILE
fi

# Log status
echo "$TIMESTAMP: Service=$STATUS, Port3478=$PORT_STATUS, Port5349=$SSL_PORT_STATUS" >> $LOG_FILE

# Check certificate expiry (warn 30 days before)
CERT_FILE="/etc/letsencrypt/live/turn.yourdomain.com/cert.pem"
if [ -f "$CERT_FILE" ]; then
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d'=' -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -lt 30 ]; then
        echo "$TIMESTAMP: WARNING - SSL certificate expires in $DAYS_LEFT days" >> $LOG_FILE
    fi
fi
EOF

# Make executable
sudo chmod +x /usr/local/bin/monitor-turnserver.sh
```

#### **Add to Cron:**
```bash
# Add monitoring to cron (every 5 minutes)
echo "*/5 * * * * /usr/local/bin/monitor-turnserver.sh" | sudo crontab -
```

### **9. Performance Optimization**

#### **System Tuning:**
```bash
# Increase file descriptors
echo "turnserver soft nofile 1048576" | sudo tee -a /etc/security/limits.conf
echo "turnserver hard nofile 1048576" | sudo tee -a /etc/security/limits.conf

# Network optimization
sudo tee -a /etc/sysctl.conf > /dev/null << 'EOF'
# TURN Server optimizations
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.core.netdev_max_backlog = 5000
EOF

# Apply changes
sudo sysctl -p
```

#### **TURN Server Performance Settings:**
```bash
# Add to turnserver.conf
sudo tee -a /etc/turnserver/turnserver.conf > /dev/null << 'EOF'
# Performance optimizations
stale-nonce=600
max-allocate-timeout=3600
allocation-default-timeout=3600
channel-lifetime=600
permission-lifetime=300
EOF
```

### **10. Backup and Recovery**

#### **Backup Script:**
```bash
sudo tee /usr/local/bin/backup-turnserver.sh > /dev/null << 'EOF'
#!/bin/bash
# TURN Server Backup Script

BACKUP_DIR="/var/backups/turnserver"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/turnserver_backup_$TIMESTAMP.tar.gz"

# Create backup directory
sudo mkdir -p $BACKUP_DIR

# Create backup
sudo tar -czf $BACKUP_FILE \
    /etc/turnserver/ \
    /var/lib/turnserver/ \
    /etc/systemd/system/coturn.service \
    /etc/letsencrypt/live/turn.yourdomain.com/

# Set permissions
sudo chown root:root $BACKUP_FILE
sudo chmod 600 $BACKUP_FILE

# Clean old backups (keep last 7 days)
sudo find $BACKUP_DIR -name "turnserver_backup_*.tar.gz" -mtime +7 -delete

echo "$(date): Backup created: $BACKUP_FILE" >> /var/log/turnserver/backup.log
EOF

# Make executable
sudo chmod +x /usr/local/bin/backup-turnserver.sh
```

#### **Add to Cron:**
```bash
# Daily backup at 2 AM
echo "0 2 * * * /usr/local/bin/backup-turnserver.sh" | sudo crontab -
```

### **11. High Availability (Optional)**

#### **Load Balancer Setup:**
```bash
# Install HAProxy
sudo apt install haproxy

# Configure HAProxy for TURN
sudo tee /etc/haproxy/haproxy.cfg > /dev/null << 'EOF'
global
    log /dev/log local0
    log /dev/log local1 notice
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin expose-fd listeners
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

defaults
    log global
    mode tcp
    option tcplog
    option dontlognull
    timeout connect 5000
    timeout client 50000
    timeout server 50000

frontend turn_frontend
    bind *:3478
    default_backend turn_backend

backend turn_backend
    balance roundrobin
    server turn1 turn-server-1.yourdomain.com:3478 check
    server turn2 turn-server-2.yourdomain.com:3478 check
EOF
```

## 🔍 Testing and Validation

### **Basic Connectivity Test:**
```bash
# Test STUN
stunclient stun.l.google.com 19302

# Test TURN (requires credentials)
turnutils_uclient -t -u your-user -w your-password turn.yourdomain.com
```

### **WebRTC Test:**
```javascript
// Test in browser console
const pc = new RTCPeerConnection({
  iceServers: [{
    urls: 'turn:turn.yourdomain.com:3478',
    username: 'your-user',
    credential: 'your-password'
  }]
});
```

### **Performance Testing:**
```bash
# Install WebRTC testing tools
npm install -g webrtcperf

# Run performance tests
webrtcperf --turn-server turn:turn.yourdomain.com:3478 --username your-user --password your-password
```

## 🚨 Troubleshooting

### **Common Issues:**

#### **1. Certificate Problems:**
```bash
# Check certificate
openssl x509 -in /etc/letsencrypt/live/turn.yourdomain.com/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect turn.yourdomain.com:5349
```

#### **2. Authentication Issues:**
```bash
# Test authentication
turnadmin -a -u your-user -r turn.yourdomain.com -p your-password

# Check user database
sudo cat /var/lib/turnserver/turnusers.txt
```

#### **3. Connection Issues:**
```bash
# Check firewall
sudo ufw status

# Check service logs
sudo journalctl -u coturn -f

# Test port connectivity
telnet turn.yourdomain.com 3478
```

#### **4. Performance Issues:**
```bash
# Monitor system resources
htop
iotop

# Check TURN server stats
sudo turnadmin -s /var/lib/turnserver/turndb.sqlite
```

## 📊 Monitoring Dashboard

### **Grafana + Prometheus Setup:**
```bash
# Install Prometheus
sudo apt install prometheus

# Install Grafana
sudo apt install grafana

# Configure TURN server metrics
# Add to turnserver.conf:
# prometheus
```

### **Key Metrics to Monitor:**
- Connection count
- Bandwidth usage
- Error rates
- Certificate expiry
- System resources
- TURN allocation success rate

## 🔐 Security Best Practices

### **Regular Updates:**
```bash
# Update system regularly
sudo apt update && sudo apt upgrade -y

# Update TURN server
sudo apt install --only-upgrade coturn
```

### **Security Scanning:**
```bash
# Install security tools
sudo apt install lynis rkhunter

# Run security audit
sudo lynis audit system
```

### **Access Control:**
```bash
# Use fail2ban for SSH protection
sudo apt install fail2ban

# Configure rate limiting in TURN server
# Add to turnserver.conf:
# user-quota=10
# total-quota=100
```

## 📚 Additional Resources

- **Coturn Documentation**: https://github.com/coturn/coturn/wiki
- **WebRTC Security**: https://webrtc-security.github.io/
- **TURN Server Best Practices**: https://tools.ietf.org/html/rfc8656
- **SSL/TLS Configuration**: https://ssl-config.mozilla.org/

## 🎯 Quick Setup Checklist

- [ ] Domain purchased and DNS configured
- [ ] SSL certificate obtained
- [ ] Server hardened and updated
- [ ] Coturn installed and configured
- [ ] Firewall configured
- [ ] Systemd service created
- [ ] Monitoring and logging set up
- [ ] Backup strategy implemented
- [ ] Performance optimized
- [ ] Security measures in place
- [ ] Testing completed

## 💡 Pro Tips

1. **Use a dedicated server** for TURN to avoid resource conflicts
2. **Monitor bandwidth usage** - TURN can consume significant bandwidth
3. **Implement rate limiting** to prevent abuse
4. **Use strong authentication** secrets and passwords
5. **Keep certificates updated** automatically
6. **Log everything** for debugging and security
7. **Test regularly** with different network conditions
8. **Have a backup server** ready for high availability

---

**Remember**: A production TURN server handles sensitive WebRTC traffic. Security, monitoring, and performance are critical for reliable service.</content>
<parameter name="filePath">/home/yama/CCTV/docs/PRODUCTION_TURN_STUN_SERVER_GUIDE.md