export const CHAIN = {
  id: 84532,
  name: 'Base Sepolia',
  explorerBaseUrl: 'https://sepolia.basescan.org',
  isPublicLedger: true,
} as const;

export const EXPLORER_ADDRESS_URL = `${CHAIN.explorerBaseUrl}/address`;
export const EXPLORER_TX_URL = `${CHAIN.explorerBaseUrl}/tx`;
