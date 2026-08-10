import { create } from 'zustand';

import { MAX_GUARD_TRIGGER_BPS, MIN_GUARD_TRIGGER_BPS } from '@/constants/protocol';
import {
  fetchEvents,
  fetchExecutions,
  fetchPosition,
  fetchPriceHistory,
} from '@/services/defralApi';
import { MOCK_POSITIONS } from '@/services/mockData';
import type {
  DataMode,
  ExecutionView,
  GuardPolicy,
  PositionView,
  PricePoint,
  RescueEventView,
} from '@/types';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DefralState {
  status: LoadStatus;
  mode: DataMode;
  degradedReason: string | null;
  position: PositionView | null;
  events: RescueEventView[];
  executions: ExecutionView[];
  priceHistory: PricePoint[];
  loadDashboard: () => Promise<void>;
  selectCollateral: (symbol: string) => void;
  setGuardTrigger: (triggerRatioBps: number) => void;
  setCouponSweep: (isEnabled: boolean) => void;
  setReserve: (amount: number) => void;
  revokeAgent: () => void;
}

function clampTrigger(triggerRatioBps: number): number {
  return Math.min(MAX_GUARD_TRIGGER_BPS, Math.max(MIN_GUARD_TRIGGER_BPS, Math.round(triggerRatioBps)));
}

function withPolicy(position: PositionView, patch: Partial<GuardPolicy>): PositionView {
  return { ...position, policy: { ...position.policy, ...patch } };
}

export const useDefralStore = create<DefralState>((set, get) => ({
  status: 'idle',
  mode: 'mock',
  degradedReason: null,
  position: null,
  events: [],
  executions: [],
  priceHistory: [],

  loadDashboard: async () => {
    set({ status: 'loading' });

    const [position, events, executions, priceHistory] = await Promise.all([
      fetchPosition(),
      fetchEvents(),
      fetchExecutions(),
      fetchPriceHistory(),
    ]);

    const results = [position, events, executions, priceHistory];
    const degraded = results.find((result) => result.degradedReason !== null);

    set({
      status: 'ready',
      mode: results.every((result) => result.mode === 'live') ? 'live' : 'mock',
      degradedReason: degraded?.degradedReason ?? null,
      position: position.data,
      events: events.data,
      executions: executions.data,
      priceHistory: priceHistory.data,
    });
  },

  selectCollateral: (symbol) => {
    const next = MOCK_POSITIONS[symbol];
    if (next) set({ position: next });
  },

  setGuardTrigger: (triggerRatioBps) => {
    const { position } = get();
    if (!position) return;
    set({ position: withPolicy(position, { triggerRatioBps: clampTrigger(triggerRatioBps) }) });
  },

  setCouponSweep: (isEnabled) => {
    const { position } = get();
    if (!position || !position.collateral.paysYield) return;
    set({ position: withPolicy(position, { isCouponSweepEnabled: isEnabled }) });
  },

  setReserve: (amount) => {
    const { position } = get();
    if (!position) return;
    set({ position: { ...position, reserve: Math.max(0, amount) } });
  },

  revokeAgent: () => {
    const { position } = get();
    if (!position) return;
    set({ position: { ...position, isAgentRevoked: true } });
  },
}));
