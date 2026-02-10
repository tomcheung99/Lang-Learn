import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use server-side rendering for the app (needed for Web LLM)
  output: 'standalone',
  
  // Enable WebAssembly support for Transformers.js
  experimental: {
    serverComponentsExternalPackages: ['@huggingface/transformers'],
  },
  
  // Headers for WASM and cross-origin isolation (needed for WebGPU)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
