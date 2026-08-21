import type { ReactNode } from 'react';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import MovieRounded from '@mui/icons-material/MovieRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import type { QuizCategoryKey } from '@/data/models';
import { WebTokens } from '@/theme/webTokens';

/**
 * Per-category tint and icon. Presentation only, so it lives with the quiz
 * screens rather than in models.ts — and it reuses the portal's existing accent
 * tokens instead of inventing four new colours.
 */
export function quizCategoryTint(key: QuizCategoryKey): string {
  switch (key) {
    case 'POLITICS':
      return WebTokens.blue;
    case 'SPORTS':
      return WebTokens.accent;
    case 'ENTERTAINMENT':
      return WebTokens.violet;
    case 'GENERAL_KNOWLEDGE':
      return WebTokens.gold;
  }
}

export function quizCategoryIcon(key: QuizCategoryKey): ReactNode {
  switch (key) {
    case 'POLITICS':
      return <AccountBalanceRounded />;
    case 'SPORTS':
      return <SportsSoccerRounded />;
    case 'ENTERTAINMENT':
      return <MovieRounded />;
    case 'GENERAL_KNOWLEDGE':
      return <SchoolRounded />;
  }
}

/** A, B, C, D — the option labels the whole feature shares. */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
