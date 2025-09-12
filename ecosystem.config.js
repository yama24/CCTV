module.exports = {
  apps: [
    {
      name: 'cctv-app',
      script: 'server.js',
      cwd: '/home/yama/CCTV',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      restart_delay: 4000,
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
};