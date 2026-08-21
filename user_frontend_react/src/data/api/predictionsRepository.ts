import { ApiClient } from '@/core/network/apiClient';
import { predictionFromApi } from '../mappers';
import type { Prediction } from '../models';

export interface SubmitResult {
  ok: boolean;
  balance: number;
}

export interface HistorySummary {
  total: number;
  won: number;
  lost: number;
  accuracy: number;
}

export const emptyHistorySummary: HistorySummary = {
  total: 0,
  won: 0,
  lost: 0,
  accuracy: 0,
};

export interface HistoryResult {
  items: Prediction[];
  summary: HistorySummary;
}

/**
 * A page of predictions plus the total count matching the query (for
 * pagination / "load more").
 */
export interface PredictionsPage {
  items: Prediction[];
  total: number;
  /**
   * True open-prediction count per category key, independent of this query's
   * own category/search/take filters — for sidebar nav badges that need every
   * category's real count, not just this page's.
   */
  categoryCounts: Record<string, number>;
}

export interface PredictionsQuery {
  status?: string;
  category?: string | null;
  featured?: boolean | null;
  search?: string | null;
  sort?: string | null;
  closingHours?: number | null;
  skip?: number;
  take?: number;
}

const toList = (data: unknown): Prediction[] =>
  (Array.isArray(data) ? data : []).map((e) => predictionFromApi(e as Record<string, any>));

const int = (v: unknown, fallback = 0): number =>
  typeof v === 'number' ? Math.trunc(v) : fallback;

export const PredictionsRepository = {
  async list(q: PredictionsQuery = {}): Promise<PredictionsPage> {
    const params: Record<string, string> = {};
    if (q.status != null) params.status = q.status;
    if (q.category != null) params.category = q.category;
    if (q.featured != null) params.featured = String(q.featured);
    if (q.search) params.search = q.search;
    if (q.sort != null) params.sort = q.sort;
    if (q.closingHours != null) params.closingHours = String(q.closingHours);
    if (q.skip != null) params.skip = String(q.skip);
    if (q.take != null) params.take = String(q.take);

    const m: any = await ApiClient.get('/predictions', params);
    const rawCounts = (m?.categoryCounts ?? {}) as Record<string, unknown>;
    const categoryCounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawCounts)) categoryCounts[k] = int(v);

    return { items: toList(m?.items), total: int(m?.total), categoryCounts };
  },

  async detail(id: string): Promise<Prediction> {
    return predictionFromApi((await ApiClient.get(`/predictions/${id}`)) as Record<string, any>);
  },

  async submit(id: string, optionId: string): Promise<SubmitResult> {
    const m: any = await ApiClient.post(`/predictions/${id}/submit`, { optionId });
    return { ok: m?.ok === true, balance: int(m?.balance) };
  },

  async active(): Promise<Prediction[]> {
    return toList(await ApiClient.get('/predictions/mine/active'));
  },

  async history(): Promise<HistoryResult> {
    const m: any = await ApiClient.get('/predictions/mine/history');
    const s = m?.summary ?? {};
    return {
      items: toList(m?.items),
      summary: {
        total: int(s.total),
        won: int(s.won),
        lost: int(s.lost),
        accuracy: typeof s.accuracy === 'number' ? s.accuracy : 0,
      },
    };
  },
};
