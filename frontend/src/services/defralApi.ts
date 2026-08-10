import { z } from 'zod';

import { PUBLIC_ENV, isBackendMode } from '@/constants/env';
import type { DataMode, ExecutionView, PositionView, PricePoint, RescueEventView } from '@/types';
import {
  MOCK_EVENTS,
  MOCK_EXECUTIONS,
  MOCK_POSITION,
  MOCK_PRICE_HISTORY,
} from '@/services/mockData';
import {
  executionListSchema,
  positionSchema,
  pricePointListSchema,
  rescueEventListSchema,
} from '@/services/schemas';

const REQUEST_TIMEOUT_MS = 8_000;

export interface ApiResult<TData> {
  data: TData;
  mode: DataMode;
  degradedReason: string | null;
}

function fallbackResult<TData>(data: TData, degradedReason: string | null): ApiResult<TData> {
  return { data, mode: 'mock', degradedReason };
}

async function readJson<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  fallback: z.infer<TSchema>,
): Promise<ApiResult<z.infer<TSchema>>> {
  if (!isBackendMode()) return fallbackResult(fallback, null);

  try {
    const response = await fetch(`${PUBLIC_ENV.NEXT_PUBLIC_API_URL}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return fallbackResult(fallback, `${path} answered ${response.status}`);
    }
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      return fallbackResult(fallback, `${path} returned an unrecognised shape`);
    }
    return { data: parsed.data, mode: 'live', degradedReason: null };
  } catch {
    return fallbackResult(fallback, `${path} could not be reached`);
  }
}

export function fetchPosition(): Promise<ApiResult<PositionView>> {
  return readJson('/api/position', positionSchema, MOCK_POSITION);
}

export function fetchEvents(): Promise<ApiResult<RescueEventView[]>> {
  return readJson('/api/events', rescueEventListSchema, MOCK_EVENTS);
}

export function fetchExecutions(): Promise<ApiResult<ExecutionView[]>> {
  return readJson('/api/executions', executionListSchema, MOCK_EXECUTIONS);
}

export function fetchPriceHistory(): Promise<ApiResult<PricePoint[]>> {
  return readJson('/api/prices', pricePointListSchema, MOCK_PRICE_HISTORY);
}
