import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CoinTxnType,
  EntryStatus,
  Prisma,
  PredictionStatus,
  BadgeKey,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isReviewAccount } from '../common/review-account';
import { EconomyService, EconomyRules } from '../economy/economy.service';
import { GamificationService } from '../gamification/gamification.service';
import { SubmitPredictionDto } from './dto/submit-prediction.dto';

/** A prediction with its options + category loaded, as returned by Prisma. */
type PredictionWithRelations = Prisma.PredictionGetPayload<{
  include: { options: true; category: true };
}>;

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly gamification: GamificationService,
  ) {}

  /** Shared include for loading a prediction with options (ordered) + category. */
  private static readonly includeOptionsCategory = {
    options: { orderBy: { order: 'asc' } },
    category: true,
  } satisfies Prisma.PredictionInclude;

  /** Serialize a prediction into the API shape. `isReviewer` zeroes
   *  entryFee/reward in the response only — never touches the stored row,
   *  so it applies uniformly to old and newly-created predictions alike,
   *  and reverts instantly for everyone the moment this account isn't the
   *  one asking. See src/common/review-account.ts.
   *
   *  entryFee/reward are resolved live against `rules` when
   *  useDefaultEconomy is true, rather than trusting the (possibly stale)
   *  stored columns — see EconomyService.resolveEntryFee/resolveReward. */
  private serialize(
    prediction: PredictionWithRelations,
    rules: EconomyRules,
    pointsEnabled: boolean,
    userEntry?: { optionId: string; status?: EntryStatus; rewardEarned?: number } | null,
    isReviewer = false,
  ) {
    const options = [...prediction.options].sort((a, b) => a.order - b.order);
    const sumVotes = options.reduce((acc, o) => acc + o.votes, 0);
    const entryFee = this.economy.resolveEntryFee(prediction, rules, pointsEnabled);
    const reward = this.economy.resolveReward(prediction, rules);

    return {
      id: prediction.id,
      category: {
        key: prediction.category.key,
        label: prediction.category.label,
        icon: prediction.category.icon,
        imageUrl: prediction.category.imageUrl,
        iconImageUrl: prediction.category.iconImageUrl,
        accent: prediction.category.accent,
      },
      title: prediction.title,
      subtitle: prediction.subtitle,
      info: prediction.info,
      bannerImageUrl: prediction.bannerImageUrl,
      entryFee: isReviewer ? 0 : entryFee,
      reward: isReviewer ? 0 : reward,
      status: prediction.status,
      featured: prediction.featured,
      participants: prediction.participants,
      closesAt: prediction.closesAt,
      createdAt: prediction.createdAt,
      options: options.map((o) => ({
        id: o.id,
        label: o.label,
        odds: o.odds,
        sharePercent: sumVotes > 0 ? Math.round((o.votes / sumVotes) * 100) : 0,
      })),
      // Only reveal the winner once a prediction is truly RESOLVED (payouts
      // done). AUTO_RESOLVED already has correctOptionId set internally so an
      // admin can confirm with one click, but leaking it earlier would show
      // users the answer before they've actually been paid.
      correctOptionId: prediction.status === PredictionStatus.RESOLVED ? prediction.correctOptionId : null,
      mySelectedOptionId: userEntry ? userEntry.optionId : undefined,
    };
  }

  /** GET /predictions — list with filters. */
  async list(
    userId: string,
    email: string | null | undefined,
    filters: {
      status?: PredictionStatus;
      category?: string;
      featured?: string;
      search?: string;
      sort?: string;
      closingHours?: string;
      skip?: string;
      take?: string;
    },
  ) {
    // Users may only browse live/settled states — never drafts or
    // not-yet-published scheduled predictions.
    const publicStatuses: PredictionStatus[] = [
      PredictionStatus.OPEN,
      PredictionStatus.LOCKED,
      PredictionStatus.RESOLVED,
    ];
    const requested = filters.status;
    const where: Prisma.PredictionWhereInput = {
      status: requested && publicStatuses.includes(requested) ? requested : PredictionStatus.OPEN,
    };
    if (filters.category) {
      where.category = { key: filters.category };
    }
    if (filters.featured === 'true') {
      where.featured = true;
    } else if (filters.featured === 'false') {
      where.featured = false;
    }
    const q = filters.search?.trim();
    if (q) {
      // Per-word AND, not one contains-the-whole-phrase check — "india
      // cricket" previously required that exact substring, so it missed a
      // title like "Will India win the cricket final?" where the words
      // appear but not contiguously. Splitting means every word just has
      // to show up somewhere in title/subtitle, in any order.
      const words = q.split(/\s+/).filter(Boolean);
      where.AND = words.map((w) => ({
        OR: [
          { title: { contains: w, mode: 'insensitive' } },
          { subtitle: { contains: w, mode: 'insensitive' } },
        ],
      }));
    }
    const closingHours = Number(filters.closingHours);
    if (closingHours > 0) {
      where.closesAt = { lte: new Date(Date.now() + closingHours * 3_600_000) };
    }

    // sort=newest mirrors the admin Predictions tab's explicit "newest"
    // mode exactly (plain createdAt-desc, no featured priority) — kept
    // exactly as-is, still fully selectable, not touched by the default
    // change below.
    //
    // The default (sort omitted) is now trending-first: featured stays
    // pinned above everything (still an editorial signal, not something an
    // algorithmic sort should override), then trendingScore desc — the
    // real-world Polymarket volume24hr snapshot for AUTO_ENTRY predictions,
    // or the live participant count for CSV/Manual ones (see the
    // trendingScore schema comment). This used to be featured-then-newest;
    // changed because a pure newest-first feed gets permanently buried
    // under the high-frequency Polymarket crypto-microbet stream, hiding
    // the predictions people are actually engaging with.
    //
    // `id` is a final tiebreaker on every branch so skip/take pagination
    // stays stable even when two rows tie on the primary/secondary key
    // (e.g. same-millisecond createdAt, or two untouched trendingScore=0
    // rows).
    const orderBy: Prisma.PredictionOrderByWithRelationInput[] =
      filters.sort === 'predicted'
        ? [{ participants: 'desc' }, { closesAt: 'asc' }, { id: 'desc' }]
        : filters.sort === 'reward'
          ? [{ reward: 'desc' }, { closesAt: 'asc' }, { id: 'desc' }]
          : filters.sort === 'soon'
            ? [{ closesAt: 'asc' }, { id: 'desc' }]
            : filters.sort === 'newest'
              ? [{ createdAt: 'desc' }, { id: 'desc' }]
              : filters.sort === 'trending'
                ? [{ featured: 'desc' }, { trendingScore: 'desc' }, { closesAt: 'asc' }, { id: 'desc' }]
                : [{ featured: 'desc' }, { trendingScore: 'desc' }, { closesAt: 'asc' }, { id: 'desc' }];

    const take = Math.min(Math.max(Number(filters.take) || 20, 1), 50);
    const skip = Math.max(Number(filters.skip) || 0, 0);

    const [total, predictions] = await this.prisma.$transaction([
      this.prisma.prediction.count({ where }),
      this.prisma.prediction.findMany({
        where,
        include: PredictionsService.includeOptionsCategory,
        orderBy,
        skip,
        take,
      }),
    ]);

    const entries = await this.prisma.userPrediction.findMany({
      where: {
        userId,
        predictionId: { in: predictions.map((p) => p.id) },
      },
      select: { predictionId: true, optionId: true },
    });
    const entryByPrediction = new Map(entries.map((e) => [e.predictionId, e]));
    const isReviewer = isReviewAccount(email);
    const [rules, pointsEnabled] = await Promise.all([this.economy.getRules(), this.economy.pointsEnabled()]);

    // Per-category open counts for the sidebar's category nav badges — not
    // scoped to `where` (which may already be category-filtered down to a
    // single category, or bounded by search/take) since the sidebar needs
    // every category's own true count regardless of what's currently being
    // browsed, the same way `total` already is for the "All Predictions"
    // count instead of `items.length`.
    const categoryCounts = await this.categoryOpenCounts();

    return {
      items: predictions.map((p) =>
        this.serialize(p, rules, pointsEnabled, entryByPrediction.get(p.id) ?? null, isReviewer),
      ),
      total,
      categoryCounts,
    };
  }

  private async categoryOpenCounts(): Promise<Record<string, number>> {
    const grouped = await this.prisma.prediction.groupBy({
      by: ['categoryId'],
      where: { status: PredictionStatus.OPEN },
      _count: { _all: true },
    });
    if (!grouped.length) return {};
    const categories = await this.prisma.category.findMany({
      where: { id: { in: grouped.map((g) => g.categoryId) } },
      select: { id: true, key: true },
    });
    const keyById = new Map(categories.map((c) => [c.id, c.key]));
    const counts: Record<string, number> = {};
    for (const row of grouped) {
      const key = keyById.get(row.categoryId);
      if (key) counts[key] = row._count._all;
    }
    return counts;
  }

  /** GET /predictions/:id — single prediction with the user's entry (if any). */
  async getOne(userId: string, email: string | null | undefined, id: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: PredictionsService.includeOptionsCategory,
    });
    if (!prediction) {
      throw new NotFoundException('Prediction not found');
    }
    const entry = await this.prisma.userPrediction.findUnique({
      where: { userId_predictionId: { userId, predictionId: id } },
      select: { optionId: true, status: true, rewardEarned: true },
    });
    const [rules, pointsEnabled] = await Promise.all([this.economy.getRules(), this.economy.pointsEnabled()]);
    return this.serialize(prediction, rules, pointsEnabled, entry, isReviewAccount(email));
  }

  /** POST /predictions/:id/submit — the core write path. */
  async submit(userId: string, id: string, dto: SubmitPredictionDto, email?: string | null) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!prediction) {
      throw new NotFoundException('Prediction not found');
    }
    if (
      prediction.status !== PredictionStatus.OPEN ||
      prediction.closesAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Prediction is closed');
    }

    const option = prediction.options.find((o) => o.id === dto.optionId);
    if (!option) {
      throw new BadRequestException('Invalid option for this prediction');
    }

    const existing = await this.prisma.userPrediction.findUnique({
      where: { userId_predictionId: { userId, predictionId: id } },
    });
    if (existing) {
      throw new ConflictException('Already submitted');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Resolved live (not the raw column) so a prediction still following the
    // default always charges whatever "Default points" currently is. The
    // store-review account is always free to enter — matches the 0 it's
    // already shown everywhere in the API response (see isReviewAccount);
    // without this it would see "free" on screen but actually get charged.
    const [rules, pointsEnabled] = await Promise.all([this.economy.getRules(), this.economy.pointsEnabled()]);
    const effectiveEntryFee = isReviewAccount(email) ? 0 : this.economy.resolveEntryFee(prediction, rules, pointsEnabled);
    if (user.coins < effectiveEntryFee) {
      throw new BadRequestException('Not enough coins');
    }

    const newBalance = await this.prisma.$transaction(async (tx) => {
      // A prediction with Points = 0 is genuinely free to enter — skip the
      // debit (and the zero-amount ledger row it would otherwise create)
      // rather than recording a no-op transaction.
      const balance =
        effectiveEntryFee > 0
          ? await this.economy.applyTxn(
              tx,
              userId,
              CoinTxnType.ENTRY_FEE,
              -effectiveEntryFee,
              {
                referenceId: prediction.id,
                description: `Entry: ${prediction.title}`,
              },
            )
          : user.coins;

      await tx.userPrediction.create({
        data: {
          userId,
          predictionId: prediction.id,
          optionId: option.id,
          entryFee: effectiveEntryFee,
          status: EntryStatus.LOCKED,
        },
      });

      await tx.prediction.update({
        where: { id: prediction.id },
        data: {
          participants: { increment: 1 },
          // trendingScore mirrors participants for CSV/Manual predictions
          // (no external market to borrow a trending signal from) — left
          // untouched for Polymarket imports, whose trendingScore is a
          // frozen real-world volume24hr snapshot from import time instead.
          ...(prediction.source !== 'AUTO_ENTRY' ? { trendingScore: { increment: 1 } } : {}),
        },
      });

      await tx.predictionOption.update({
        where: { id: option.id },
        data: { votes: { increment: 1 } },
      });

      const u = await tx.user.update({
        where: { id: userId },
        data: { totalPredictions: { increment: 1 } },
        select: { totalPredictions: true, correctPredictions: true, level: true },
      });

      if (u.totalPredictions === 1) {
        await this.gamification.awardBadge(tx, userId, BadgeKey.FIRST_PREDICTION);
      }

      const lvl = this.gamification.levelFromStats(u);
      if (lvl !== u.level) {
        await tx.user.update({
          where: { id: userId },
          data: { level: lvl },
        });
      }

      return balance;
    });

    return {
      ok: true,
      balance: newBalance,
      entry: {
        predictionId: prediction.id,
        optionId: option.id,
        status: EntryStatus.LOCKED,
      },
    };
  }

  /** GET /predictions/mine/active — entries on OPEN/LOCKED predictions.
   *  AUTO_RESOLVED counts as still-active here too: Polymarket has a winner
   *  internally, but the entry itself is untouched (still EntryStatus.LOCKED)
   *  until an admin confirms payout, so it must keep showing as pending
   *  rather than vanishing from the user's list. */
  async mineActive(userId: string, email: string | null | undefined) {
    const isReviewer = isReviewAccount(email);
    const [rules, pointsEnabled] = await Promise.all([this.economy.getRules(), this.economy.pointsEnabled()]);
    const entries = await this.prisma.userPrediction.findMany({
      where: {
        userId,
        prediction: {
          status: { in: [PredictionStatus.OPEN, PredictionStatus.LOCKED, PredictionStatus.AUTO_RESOLVED] },
        },
      },
      include: {
        prediction: { include: PredictionsService.includeOptionsCategory },
      },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map((e) => ({
      ...this.serialize(
        e.prediction,
        rules,
        pointsEnabled,
        { optionId: e.optionId, status: e.status, rewardEarned: e.rewardEarned },
        isReviewer,
      ),
      entryStatus: e.status,
    }));
  }

  /** GET /predictions/mine/history — resolved (WON/LOST) entries + summary. */
  async mineHistory(userId: string, email: string | null | undefined) {
    const isReviewer = isReviewAccount(email);
    const [rules, pointsEnabled] = await Promise.all([this.economy.getRules(), this.economy.pointsEnabled()]);
    const entries = await this.prisma.userPrediction.findMany({
      where: {
        userId,
        status: { in: [EntryStatus.WON, EntryStatus.LOST] },
      },
      include: {
        prediction: { include: PredictionsService.includeOptionsCategory },
      },
      orderBy: { resolvedAt: 'desc' },
    });

    const items = entries.map((e) => ({
      ...this.serialize(
        e.prediction,
        rules,
        pointsEnabled,
        { optionId: e.optionId, status: e.status, rewardEarned: e.rewardEarned },
        isReviewer,
      ),
      entryStatus: e.status,
      rewardEarned: isReviewer ? 0 : e.rewardEarned,
    }));

    const total = entries.length;
    const won = entries.filter((e) => e.status === EntryStatus.WON).length;
    const lost = entries.filter((e) => e.status === EntryStatus.LOST).length;
    const summary = {
      total,
      won,
      lost,
      // A 0-1 ratio, matching every other accuracy field in the system
      // (users.service.ts, leaderboard.service.ts, admin.service.ts, the
      // Flutter AppUser.accuracy getter) — this used to send an
      // already-converted percentage (e.g. 100), which the client's
      // AccuracyGauge then multiplied by 100 again, turning a genuine 100%
      // into a displayed "10000%".
      accuracy: total > 0 ? won / total : 0,
    };

    return { summary, items };
  }
}
