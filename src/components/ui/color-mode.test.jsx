import { render } from '@testing-library/react'
import { Provider } from './provider'

// The app is designed dark-only. On a light OS/browser Chakra followed the system
// setting and turned its own surfaces white while the app's chrome stayed dark.
function stubLightSystem() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('ColorModeProvider', () => {
  beforeEach(() => {
    stubLightSystem()
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('uses dark mode on a light system', () => {
    render(<Provider><div /></Provider>)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('uses dark mode even when light was stored', () => {
    localStorage.setItem('theme', 'light')

    render(<Provider><div /></Provider>)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})
