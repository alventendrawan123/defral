export const ONBOARDING_STEPS = [
  'Pick collateral',
  'Borrow',
  'Set reserve',
  'Set guard trigger',
] as const;

export const DEMO_BORROWERS = [
  {
    id: 'rina',
    name: 'Rina',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    summary: 'Treasury collateral that pays a coupon. The sweep applies.',
  },
  {
    id: 'arif',
    name: 'Arif',
    address: '0x9876543210fedcba9876543210fedcba98765432',
    summary: 'Gold collateral that pays no yield. The same engine guards it.',
  },
] as const;
