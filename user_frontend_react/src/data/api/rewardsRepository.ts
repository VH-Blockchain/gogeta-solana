import { ApiClient } from '@/core/network/apiClient';
import { timeAgo } from '../mappers';
import type { RewardKind, RewardTxn } from '../models';

/** Aggregated rewards summary used by the Rewards page hero + stat tiles. */
export interface RewardsSummary {
  balance: number;
  earnedTotal: number;
  thisWeek: number;
  luckyWins: number;
  recent: RewardTxn[];
}

const int = (v: unknown, fallback = 0): number =>
  typeof v === 'number' ? Math.trunc(v) : fallback;

function kindFromType(type?: string | null): RewardKind {
  switch (type) {
    case 'SIGNUP_BONUS':
      return 'signup';
    case 'ENTRY_FEE':
    // A free (entryFee = 0) prediction submission never creates a
    // CoinTransaction — see rewards.service.ts's getSummary — so the backend
    // reports these as a distinct type, but they're still conceptually the
    // same "you made a pick" activity.
    case 'PREDICTION_SUBMITTED':
      return 'entry';
    case 'CORRECT_REWARD':
      return 'correct';
    case 'LUCKY_BONUS':
      return 'lucky';
    default:
      return 'bonus';
  }
}

const labelForKind: Record<RewardKind, string> = {
  signup: 'Signup bonus',
  entry: 'Entry fee',
  correct: 'Correct call',
  lucky: 'Lucky winner',
  bonus: 'Bonus',
};

export function txnFromJson(map: Record<string, any>): RewardTxn {
  const kind = kindFromType(map.type);
  const title = typeof map.title === 'string' ? map.title.trim() : '';
  return {
    id: String(map.id ?? ''),
    kind,
    title: title || labelForKind[kind],
    amount: int(map.amount),
    timeAgo: timeAgo(map.createdAt),
  };
}

/** Live coin-economy data. */
export const RewardsRepository = {
  async summary(): Promise<RewardsSummary> {
    const m: any = await ApiClient.get('/rewards/summary');
    return {
      balance: int(m?.balance),
      earnedTotal: int(m?.earnedTotal),
      thisWeek: int(m?.thisWeek),
      luckyWins: int(m?.luckyWins),
      recent: ((m?.recent as any[]) ?? []).map((e) => txnFromJson(e as Record<string, any>)),
    };
  },

  async transactions(filter: string): Promise<RewardTxn[]> {
    const data = await ApiClient.get<any[]>('/rewards/transactions', { filter });
    return (data ?? []).map((e) => txnFromJson(e as Record<string, any>));
  },
};
