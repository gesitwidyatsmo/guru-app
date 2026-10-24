// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill standard Web APIs for Next.js App Router route testing in jsdom
global.Request = global.Request || globalThis.Request;
global.Response = global.Response || globalThis.Response;
global.Headers = global.Headers || globalThis.Headers;
global.fetch = global.fetch || globalThis.fetch;

// Mock environment variables for testing
process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = 'test-private-key';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useParams() {
    return {};
  },
}));

// Mock SweetAlert2
jest.mock('sweetalert2', () => ({
  fire: jest.fn(() => Promise.resolve({ isConfirmed: true })),
  default: {
    fire: jest.fn(() => Promise.resolve({ isConfirmed: true })),
  },
}));

// Suppress console errors in tests (optional)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
