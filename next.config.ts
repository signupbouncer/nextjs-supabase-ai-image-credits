import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local Supabase sends people back to http://127.0.0.1:3000 (site_url in supabase/config.toml). Next.js 16 only
  // serves its dev scripts to localhost by default, so without this the pages never hydrate on 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
