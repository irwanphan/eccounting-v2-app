/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@eccounting/shared', '@eccounting/db'],
  experimental: {
    typedRoutes: true,
  },
  webpack: (config) => {
    // packages/shared (dan workspace packages lain) pakai NodeNext-style imports
    // dengan extension ".js" di source ".ts". Kasih tahu webpack untuk fallback
    // ke .ts / .tsx ketika me-resolve specifier ".js".
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';
    return [
      // Proxy ke API saat dev untuk avoid CORS preflight
      {
        source: '/api/proxy/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
