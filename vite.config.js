import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

// Demo builds: every import of src/helpers/transport.js gets src/demo/DemoTransport.js
// instead, so the app talks to the in-browser DemoServer. The token editor's build gets
// src/tokenTool/ToolTransport.js (no server at all). Other builds never see either.
const swapTransport = (name, file) => {
  const transportFile = path.resolve(__dirname, 'src/helpers/transport.js')
  const replacement = path.resolve(__dirname, file)
  return {
    name,
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!/transport(\.js)?$/.test(source) || importer === replacement) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved && path.resolve(resolved.id) === transportFile ? replacement : null
    },
  }
}

// The host build (REACT_APP_MODE=host) runs the browser host's AppBundle (NordvikManager.Wasm.Host)
// in the page: NORDVIK_WASM_BUNDLE is that folder. It's served at ./wasm/ by the dev server and
// copied to <outDir>/wasm/ by the build (a worker must be the page's own origin).
const WASM_TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.html': 'text/html', '.dat': 'application/octet-stream', '.css': 'text/css' }
const hostBundle = (bundle) => {
  const folder = bundle && path.resolve(bundle)
  const check = () => {
    if (!folder || !fs.existsSync(path.join(folder, 'host.js')))
      throw new Error(`The host build needs NORDVIK_WASM_BUNDLE: the browser host's AppBundle folder (with host.js), got ${bundle || 'nothing'}`)
  }
  let outDir
  return {
    name: 'nordvik-wasm-bundle',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir) },
    buildStart() { check() },
    configureServer(server) {
      check()
      server.middlewares.use((req, res, next) => {
        const match = /\/wasm\/(.*)$/.exec(decodeURIComponent((req.url || '').split('?')[0]))
        if (!match) return next()
        const file = path.join(folder, match[1] || 'index.html')
        if (!file.startsWith(folder) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next()
        res.setHeader('Content-Type', WASM_TYPES[path.extname(file)] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      fs.cpSync(folder, path.join(outDir, 'wasm'), { recursive: true })
      // Installed as an app, it's the game host (its own name, a window rather than full screen).
      const manifest = path.join(outDir, 'manifest.json')
      if (fs.existsSync(manifest)) {
        const app = JSON.parse(fs.readFileSync(manifest, 'utf8'))
        fs.writeFileSync(manifest, JSON.stringify({ ...app, name: 'NordvikManager game host', short_name: 'Nordvik host', display: 'standalone' }, null, 2))
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load all vars from .env files (empty prefix = load everything)
  const fileEnv = loadEnv(mode, process.cwd(), '')

  // Merge file vars with process.env so cross-env vars (e.g. REACT_APP_MODE) take precedence
  const reactAppDefines = Object.fromEntries(
    // Defaults for optional vars, so code can read them in every build.
    Object.entries({ REACT_APP_TOKEN_EDITOR_URL: '', ...fileEnv, ...process.env })
      .filter(([k]) => k.startsWith('REACT_APP_'))
      .map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
  )

  const appMode = ({ ...fileEnv, ...process.env }).REACT_APP_MODE
  const isPlayer = appMode === 'player'
  const isDemo = appMode === 'demo'
  const isTokens = appMode === 'tokens'
  const isHost = appMode === 'host'

  return {
    // Player builds use a relative base so the same build works both at /client/ (latest)
    // and at /client/p<N>/ (frozen build per protocol version, see src/helpers/protocol.js).
    // The demo is served from /client/demo/, the token editor from /client/tokens/.
    // The host build is served from /client/host/.
    base: isPlayer || isDemo || isTokens || isHost ? './' : '/',
    plugins: [
      react(),
      ...(isDemo ? [swapTransport('nordvik-demo-transport', 'src/demo/DemoTransport.js')] : []),
      ...(isTokens ? [swapTransport('nordvik-tokens-transport', 'src/tokenTool/ToolTransport.js')] : []),
      ...(isHost ? [hostBundle(({ ...fileEnv, ...process.env }).NORDVIK_WASM_BUNDLE)] : []),
    ],

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
