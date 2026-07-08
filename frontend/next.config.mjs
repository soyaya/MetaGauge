/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Removed: use Cloudflare Pages Next.js preset instead
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Set output file tracing root to silence workspace warning
  outputFileTracingRoot: process.cwd(),
  // Force webpack mode
  experimental: {},
  // Silence Turbopack warning
  turbopack: {},
  
  // Add headers to allow Web3 libraries to work (CSP fix)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com", // Allow eval for Web3 libraries
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.onrender.com wss://*.onrender.com http://localhost:5000 https://*.infura.io https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://*.lisk.com https://eth.merkle.io https://*.alchemy.com https://*.quicknode.pro https://*.publicnode.com https://api.web3modal.org https://*.reown.com https://pulse.walletconnect.com https://pulse.walletconnect.org https://accounts.google.com https://www.googleapis.com",
              "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
  
  webpack: (config, { isServer }) => {
    // Exclude problematic node_modules from being processed
    config.module.rules.push({
      test: /node_modules\/thread-stream\/(test|bench|LICENSE|README\.md)/,
      use: 'ignore-loader',
    });
    
    // Add fallbacks for problematic modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'tap': false,
      'fastbench': false,
      'desm': false,
      'pino-elasticsearch': false,
      'tape': false,
      'why-is-node-running': false,
      '@react-native-async-storage/async-storage': false,
      // Add Web3 fallbacks
      'fs': false,
      'net': false,
      'tls': false,
      'crypto': false,
    };

    // Exclude test files from being processed
    config.module.rules.push({
      test: /\.(test|spec)\.(js|mjs|ts|tsx)$/,
      use: 'ignore-loader',
    });
    
    // Handle Web3 externals for server-side
    if (isServer) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding');
    }

    return config;
  },
}

export default nextConfig

// Only run Cloudflare dev init in development mode (causes EPIPE in production builds)
if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
