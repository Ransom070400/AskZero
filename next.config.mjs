/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image is not used anywhere (attachments render as plain <img>), so no
  // remotePatterns are needed and the Cloudflare Images binding can stay off.
};

export default nextConfig;
