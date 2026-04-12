import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dc", destination: "/dmv", permanent: true },
      {
        source: "/montgomery-county",
        destination: "/dmv",
        permanent: true,
      },
      { source: "/baltimore", destination: "/dmv", permanent: true },
    ];
  },
};

export default nextConfig;
