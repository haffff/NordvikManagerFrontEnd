import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load all vars from .env files (empty prefix = load everything)
  const fileEnv = loadEnv(mode, process.cwd(), '')

  // Merge file vars with process.env so cross-env vars (e.g. REACT_APP_MODE) take precedence
  const reactAppDefines = Object.fromEntries(
    Object.entries({ ...fileEnv, ...process.env })
      .filter(([k]) => k.startsWith('REACT_APP_'))
      .map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
  )

  const isPlayer = ({ ...fileEnv, ...process.env }).REACT_APP_MODE === 'player'

  return {
    base: isPlayer ? '/client/' : '/',
    plugins: [react()],

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      ...reactAppDefines,
    },

    // Treat all .js and .jsx files in src as JSX (CRA allowed JSX in .js files)
    // Must set exclude to override Vite's default exclude of /\.js$/
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: /node_modules/,
    },

    // Same for dependency pre-bundling
    optimizeDeps: {
      esbuildOptions: {
        loader: { '.js': 'jsx' },
      },
    },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.js'],
      server: {
        deps: {
          // Force ESM processing for styled-components and the dockable library
          // so that `styled.div` resolves correctly in the jsdom environment.
          inline: ['styled-components', /@hlorenzi\/react-dockable/, '@emotion/react', '@emotion/cache', '@chakra-ui/react'],
        },
      },
    },
  }
})
