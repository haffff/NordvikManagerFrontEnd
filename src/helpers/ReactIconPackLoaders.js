// Vite requires statically-analyzable import() paths. A fully dynamic template
// literal like `import(\`react-icons/${pack}\`)` is invisible to the bundler and
// will fail at runtime. Each entry here is a static string that Vite can resolve.
//
// Shared between TokenManager.js (enlivening a "reactIcon" token addition) and
// TokenIconPickerOverlay.js (rendering the same icons as picker previews) — one
// table, so a supported pack list only ever needs updating in one place.
export const ICON_PACK_LOADERS = {
  ai:  () => import('react-icons/ai'),
  bi:  () => import('react-icons/bi'),
  bs:  () => import('react-icons/bs'),
  cg:  () => import('react-icons/cg'),
  ci:  () => import('react-icons/ci'),
  di:  () => import('react-icons/di'),
  fa:  () => import('react-icons/fa'),
  fa6: () => import('react-icons/fa6'),
  fc:  () => import('react-icons/fc'),
  fi:  () => import('react-icons/fi'),
  gi:  () => import('react-icons/gi'),
  go:  () => import('react-icons/go'),
  gr:  () => import('react-icons/gr'),
  hi:  () => import('react-icons/hi'),
  hi2: () => import('react-icons/hi2'),
  im:  () => import('react-icons/im'),
  io:  () => import('react-icons/io'),
  io5: () => import('react-icons/io5'),
  lia: () => import('react-icons/lia'),
  lu:  () => import('react-icons/lu'),
  md:  () => import('react-icons/md'),
  pi:  () => import('react-icons/pi'),
  ri:  () => import('react-icons/ri'),
  rx:  () => import('react-icons/rx'),
  si:  () => import('react-icons/si'),
  sl:  () => import('react-icons/sl'),
  tb:  () => import('react-icons/tb'),
  tfi: () => import('react-icons/tfi'),
  ti:  () => import('react-icons/ti'),
  vsc: () => import('react-icons/vsc'),
  wi:  () => import('react-icons/wi'),
};

export default ICON_PACK_LOADERS;
