// jest-dom adds custom matchers for asserting on DOM nodes (works with Vitest too)
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

// Chakra UI v3 relies on these browser APIs that jsdom does not implement.
// Provide minimal stubs so ChakraProvider can initialise without hanging.
if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class IntersectionObserver {
      constructor(cb) { this._cb = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

/**
 * Renders a component wrapped in the Chakra UI provider.
 * Use this instead of RTL's `render` for components that use Chakra UI.
 *
 * @example
 * import { renderWithProviders } from '../setupTests';
 * const { getByText } = renderWithProviders(<LoginPanel />);
 */
export function renderWithProviders(ui, options = {}) {
  const Wrapper = ({ children }) => (
    <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}
