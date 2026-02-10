/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Webpack 配置 - 排除原生 Node.js 模塊
  webpack: (config, { isServer }) => {
    // 排除 onnxruntime-node 原生二進制文件
    config.externals.push({
      'onnxruntime-node': 'commonjs onnxruntime-node',
    });
    
    // 處理 .node 二進制文件
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });
    
    // 忽略 fs 等 Node.js 模塊在客戶端的引用
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        crypto: false,
        http: false,
        https: false,
        zlib: false,
        stream: false,
        path: false,
        os: false,
        url: false,
        assert: false,
        constants: false,
        timers: false,
        tty: false,
        punycode: false,
        querystring: false,
        string_decoder: false,
        sys: false,
      };
    }
    
    return config;
  },
  
  // 跨域 headers 用於 WebGPU
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
  
  // 實驗性功能
  experimental: {
    serverComponentsExternalPackages: ['@huggingface/transformers'],
  },
};

module.exports = nextConfig;
