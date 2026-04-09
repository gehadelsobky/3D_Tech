module.exports = {
  apps: [{
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
  }],
};
