/** @type {import('next').NextConfig} */
const FRAME_ANCESTORS =
  "frame-ancestors https://web.connect.trimble.com https://*.connect.trimble.com https://app.connect.trimble.com;";

const nextConfig = {
  transpilePackages: ["trimble-connect-workspace-api"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: FRAME_ANCESTORS },
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
