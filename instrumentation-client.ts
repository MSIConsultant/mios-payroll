import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of sessions for performance tracing (free tier friendly)
  tracesSampleRate: 0.1,

  // Replay 1% of all sessions, 100% of sessions with an error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
});
