/** @type {import('next').NextConfig} */
const nextConfig = {
  // 0G Storage SDK uses Node built-ins (node:fs) and ships its own ESM/CJS —
  // keep it external to the server bundle so Next doesn't try to bundle it.
  experimental: {
    serverComponentsExternalPackages: ["@0glabs/0g-ts-sdk"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
