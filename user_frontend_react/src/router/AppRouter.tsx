import { useEffect } from 'react';
import {
  Navigate,
  Route,
  Routes as RouterRoutes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { setPushNavigator } from '@/core/push/webPushNavigation';
import { LandingPage } from '@/features/landing/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ContactPage } from '@/features/legal/ContactPage';
import { PrivacyPage, TermsPage } from '@/features/legal/CmsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PredictionsPage } from '@/features/predictions/PredictionsPage';
import { QuizPage } from '@/features/quiz/QuizPage';
import { QuizPlayPage } from '@/features/quiz/QuizPlayPage';
import { QuizResultPage } from '@/features/quiz/QuizResultPage';
import { PointsPage } from '@/features/points/PointsPage';
import { LeaderboardPage } from '@/features/leaderboard/LeaderboardPage';
import { LuckyWinnersPage } from '@/features/leaderboard/LuckyWinnersPage';
import { RewardsPage } from '@/features/rewards/RewardsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { WebShell } from '@/shell/WebShell';
import { PortalGuard } from './PortalGuard';
import { Routes } from './routes';

/**
 * The portal's route table. Clean, path-based URLs (no hash routing) — these
 * routes are written assuming path-based URLs, so the host must serve
 * index.html for unknown paths (see README).
 *
 * Public: landing, auth pages, legal pages. Everything under the shell is
 * guarded by PortalGuard.
 */
export function AppRouter() {
  return (
    <>
      <RouteEffects />
      <RouterRoutes>
        {/* ---- Public ---- */}
        <Route path={Routes.landing} element={<LandingPage />} />
        <Route path={Routes.login} element={<LoginPage />} />
        <Route path={Routes.register} element={<RegisterPage />} />
        <Route path={Routes.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={Routes.privacy} element={<PrivacyPage />} />
        <Route path={Routes.terms} element={<TermsPage />} />
        <Route path={Routes.contact} element={<ContactPage />} />

        {/* ---- Portal (inside the shell, session required) ---- */}
        <Route element={<PortalGuard />}>
          <Route element={<WebShell />}>
            <Route path={Routes.dashboard} element={<DashboardPage />} />
            <Route path={Routes.predictions} element={<PredictionsPage />} />
            {/* Play and result are declared before the /quiz index route so
                neither is swallowed by it. */}
            <Route path={`${Routes.quizPlay}/:quizId`} element={<QuizPlayPage />} />
            <Route path={`${Routes.quizResult}/:quizId`} element={<QuizResultPage />} />
            <Route path={Routes.quiz} element={<QuizPage />} />
            <Route path={Routes.points} element={<PointsPage />} />
            {/* The more specific lucky-winners path must precede the
                leaderboard index route it nests under. */}
            <Route path={Routes.luckyWinners} element={<LuckyWinnersPage />} />
            <Route path={Routes.leaderboard} element={<LeaderboardPage />} />
            <Route path={Routes.rewards} element={<RewardsPage />} />
            <Route path={Routes.profile} element={<ProfilePage />} />
            <Route path={Routes.notifications} element={<NotificationsPage />} />
          </Route>
        </Route>

        {/* Unknown path — land on the public entry point rather than a blank
            screen. */}
        <Route path="*" element={<Navigate to={Routes.landing} replace />} />
      </RouterRoutes>
    </>
  );
}

/**
 * Cross-cutting router side effects: hands the imperative navigator to the push
 * handler, and scrolls a newly-opened page back to the top (Flutter pushed a
 * fresh route each time, which always started at the top).
 */
function RouteEffects() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setPushNavigator((path) => navigate(path));
  }, [navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.querySelector('.shell__content')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return null;
}
