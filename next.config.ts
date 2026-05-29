import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Per-icon tree-shaking for libraries that ship a barrel file. Even with our
  // existing named-import discipline, this guarantees one bundle entry per
  // used symbol — protects against future regressions if someone adds a
  // wildcard import.
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Silent in CI / when no auth token — source maps upload is optional
  silent: !process.env.SENTRY_AUTH_TOKEN,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Disable source map upload in dev to keep builds fast
  sourcemaps: { disable: process.env.NODE_ENV !== 'production' },
  // Don't add Sentry telemetry to the bundle
  telemetry: false,
  // Tree-shake Sentry debug logging out of the production bundle
  webpack: { treeshake: { removeDebugLogging: true } },
});
