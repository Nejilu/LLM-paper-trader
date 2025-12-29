/** @type {import('next').NextConfig} */
const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "");

if (!process.env.API_ORIGIN) {
  // eslint-disable-next-line no-console
  console.warn("API_ORIGIN is not set. Falling back to http://localhost:3001");
}

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`
      },
      {
        source: "/healthz",
        destination: `${apiOrigin}/healthz`
      }
    ];
  }
};

module.exports = nextConfig;
