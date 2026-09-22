// PM2 en la instancia Lightsail compartida (ADR-0003). Puertos 3010/3011: 3001 y 3003 ya están ocupados.
// Los secretos viven en /home/ubuntu/constellation/api/.env (fuera del repo); la API lo carga sola.
const ROOT = '/home/ubuntu/constellation';

module.exports = {
  apps: [
    {
      name: 'constellation-api',
      cwd: `${ROOT}/api`,
      script: 'dist/main.js',
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env_production: { NODE_ENV: 'production', PORT: 3011 },
    },
    {
      name: 'constellation-web',
      cwd: `${ROOT}/web`,
      script: 'server.js',
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env_production: { NODE_ENV: 'production', PORT: 3010, HOSTNAME: '127.0.0.1' },
    },
  ],
};
