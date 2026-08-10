export const ROUTES = {
  landing: '/',
  connect: '/connect',
  onboarding: '/onboarding',
  borrow: '/borrow',
  dashboard: '/dashboard',
  vault: '/vault',
  proof: '/proof',
} as const;

export const NAV_LINKS = [
  { href: ROUTES.landing, label: 'Overview' },
  { href: ROUTES.dashboard, label: 'Dashboard' },
  { href: ROUTES.vault, label: 'Reserve and policy' },
  { href: ROUTES.proof, label: 'Proof' },
] as const;
