/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mssql', 'tedious'],
  // Self-contained server (server.js + only the node_modules it needs) for IIS / server deployment
  output: 'standalone',
};

export default nextConfig;
