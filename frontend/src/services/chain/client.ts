import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

import { PUBLIC_ENV } from '@/constants/env';

const RPC_TIMEOUT_MS = 8_000;

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(PUBLIC_ENV.NEXT_PUBLIC_RPC_URL, { timeout: RPC_TIMEOUT_MS, retryCount: 1 }),
});
