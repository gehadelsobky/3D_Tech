module.exports = {
  apps: [
    {
      name: '3dtech',
      script: 'server/index.js',
      node_args: '--env-file=.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      // Logging
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Graceful restart
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
    {
      name: '3dtech-backup',
      script: 'server/backup-cron.js',
      node_args: '--env-file=.env',
      cron_restart: '0 2 * * *',  // Daily at 2:00 AM
      autorestart: false,
      watch: false,
      error_file: 'logs/backup-error.log',
      out_file: 'logs/backup-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
