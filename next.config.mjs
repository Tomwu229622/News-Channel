/** @type {import('next').NextConfig} */
const nextConfig = {
  // 這些是 server 端模組，不要打包進前端 bundle
  serverExternalPackages: ['playwright', 'node-cron', 'nodemailer'],
  // 明確指定專案根目錄，避免偵測到家目錄的其他 lockfile
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
