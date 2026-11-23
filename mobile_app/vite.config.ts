import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import { readFileSync } from 'node:fs'

const base = process.env.BASE_PATH || '/'
const isPreview = process.env.IS_PREVIEW  ? true : false;

// App version, read from the Android build file so there is one place to bump it.
// Native builds read the real installed version at runtime; this is the value
// used on the web and as a fallback.
function readAppVersion() {
  try {
    const gradle = readFileSync(resolve(__dirname, 'android/app/build.gradle'), 'utf8');
    const code = gradle.match(/versionCode\s+(\d+)/);
    const name = gradle.match(/versionName\s+"([^"]+)"/);
    return { code: code ? parseInt(code[1], 10) : 0, name: name ? name[1] : '0.0.0' };
  } catch {
    return { code: 0, name: '0.0.0' };
  }
}
const appVersion = readAppVersion();
// https://vite.dev/config/
export default defineConfig({
  define: {
   __BASE_PATH__: JSON.stringify(base),
   __IS_PREVIEW__: JSON.stringify(isPreview),
   __APP_VERSION_CODE__: JSON.stringify(appVersion.code),
   __APP_VERSION_NAME__: JSON.stringify(appVersion.name)
  },
  plugins: [react(),
    AutoImport({
      imports: [
        {
          'react': [
            'React',
            'useState',
            'useEffect',
            'useContext',
            'useReducer',
            'useCallback',
            'useMemo',
            'useRef',
            'useImperativeHandle',
            'useLayoutEffect',
            'useDebugValue',
            'useDeferredValue',
            'useId',
            'useInsertionEffect',
            'useSyncExternalStore',
            'useTransition',
            'startTransition',
            'lazy',
            'memo',
            'forwardRef',
            'createContext',
            'createElement',
            'cloneElement',
            'isValidElement'
          ]
        },
        {
          'react-router-dom': [
            'useNavigate',
            'useLocation',
            'useParams',
            'useSearchParams',
            'Link',
            'NavLink',
            'Navigate',
            'Outlet'
          ]
        },
        // React i18n
        {
          'react-i18next': [
            'useTranslation',
            'Trans'
          ]
        }
      ],
      dts: true,
    }),
  ],
  base: '/',
  build: {
    sourcemap: true,
    outDir: 'out',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
