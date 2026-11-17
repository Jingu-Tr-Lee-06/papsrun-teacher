/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Leaflet 지도 이중 마운트 및 타일 깜빡임 방지
  transpilePackages: ['react-leaflet'],
};

module.exports = nextConfig;