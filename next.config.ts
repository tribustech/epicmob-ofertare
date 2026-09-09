import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // pozele de schiță trimise la server action pot depăși 1MB (default) — ridicăm limita
    serverActions: { bodySizeLimit: '50mb' },
  },
};

export default nextConfig;
