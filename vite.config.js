import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Demo builds: every import of src/helpers/transport.js gets src/demo/DemoTransport.js
// instead, so the app talks to the in-browser DemoServer. Other builds never see it.
const demoTransport = () => {
  const transportFile = path.resolve(__dirname, 'src/helpers/transport.js')
  const demoFile = path.resolve(__dirname, 'src/demo/DemoTransport.js')
  return {
    name: 'nordvik-demo-transport',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!/transport(\.js)?$/.test(source) || importer === demoFile) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved && path.resolve(resolved.id) === transportFile ? demoFile : null
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load all vars from .env files (empty prefix = load everything)
  const fileEnv = loadEnv(mode, process.cwd(), '')

  // Merge file vars with process.env so cross-env vars (e.g. REACT_APP_MODE) take precedence
  const reactAppDefines = Object.fromEntries(
    Object.entries({ ...fileEnv, ...process.env })
      .filter(([k]) => k.startsWith('REACT_APP_'))
      .map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
  )

  const appMode = ({ ...fileEnv, ...process.env }).REACT_APP_MODE
  const isPlayer = appMode === 'player'
  const isDemo = appMode === 'demo'

  return {
    // Player builds use a relative base so the same build works both at /client/ (latest)
    // and at /client/p<N>/ (frozen build per protocol version, see src/helpers/protocol.js).
    // The demo is served from /client/demo/.
    base: isPlayer || isDemo ? './' : '/',
    plugins: [react(), ...(isDemo ? [demoTransport()] : [])],

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
      // Vitest blanks CSS files unless listed here; helpers/cardAppStyles.js
      // reads these two as text (?raw) and its tests check that text; so does
      // the demo's mock game (src/demo/mock), for its card template.
      css: { include: [/stylesheets[\\/](panel|card-base)\.css/, /demo[\\/]mock[\\/]/] },
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
