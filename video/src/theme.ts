// theme.ts — matches frontend/src/styles/globals.css exactly.
// Every color, radius, and shadow token here mirrors the live product so the
// video and the app never visually diverge.

export const COLORS = {
  paper: '#faf7f2',
  surface: '#ffffff',
  surfaceSunken: '#f1ece3',
  ink: '#17171a',
  inkMuted: '#56545f',
  line: '#17171a',
  lineSoft: '#d9d2c6',

  safe: '#2f6b3c',
  safeSoft: '#dcebdd',
  defending: '#8a5a0b',
  defendingSoft: '#f6e8cd',
  critical: '#a33a28',
  criticalSoft: '#f6ddd7',
  accent: '#2f4b7c',

  // Video-only: pure black for intro/outro title cards.
  black: '#0a0a0a',
  white: '#ffffff',
} as const;

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 9999,
} as const;

export const SHADOW = {
  raised: `0 1px 0 0 ${COLORS.line}`,
  card: `3px 3px 0 0 ${COLORS.line}`,
  lifted: `6px 6px 0 0 ${COLORS.line}`,
} as const;

// Canonical demo numbers — identical across Solidity, agent, and UI.
// See docs/CONTRACTS.md and docs/PRD-defral.md §4.3.
export const DEMO = {
  vaultAddress: '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35',
  borrowerAddress: '0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2',
  agentAddress: '0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3',
  deployerAddress: '0xe2d3B7FEA35Ea3B7B8d530cfF58a8227ce62BFAD',
  oracleAddress: '0x44B94bb593F6De51Ad3385264C0168eEc8E56392',
  dusdAddress: '0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838',

  healthyBps: 16667,
  triggerBps: 13000,
  targetBps: 14500,
  liquidationBps: 11000,
  dippedBps: 11500,
  restoredBps: 14500,

  debtOpen: 6000,
  reserveOpen: 1500,
  maxRepayPerEvent: 2000,
  amountRepaid: 758.62,

  priceOpen: 1.0,
  priceDipped: 0.58982112,

  notAgentTx: '0xb6a01688e55ebb71713a01c02b46318b6a71039bc79e155d1fd90e957700139d',
  rescueTx: '0xb8f47a89115841e5d0176fd6cd3a0d8d9ec1141baaafde37c4ad11afb3a46c9e',
  priceDipTx: '0x4bc491317cd85888f994a07dfb13c8af9fb81160792ea451b9ef43fe7743ee9c',
  refusedHealthyExecId: '18s842dcekxxtkz0tq61d',

  githubRepo: 'github.com/alventendrawan123/defral',
} as const;

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
