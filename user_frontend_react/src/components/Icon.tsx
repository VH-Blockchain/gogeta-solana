import type { SvgIconProps } from '@mui/material/SvgIcon';
import CategoryRounded from '@mui/icons-material/CategoryRounded';
import SportsBasketballRounded from '@mui/icons-material/SportsBasketballRounded';
import CurrencyBitcoinRounded from '@mui/icons-material/CurrencyBitcoinRounded';
import ShowChartRounded from '@mui/icons-material/ShowChartRounded';
import MovieRounded from '@mui/icons-material/MovieRounded';
import SportsEsportsRounded from '@mui/icons-material/SportsEsportsRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import CloudRounded from '@mui/icons-material/CloudRounded';
import ScienceRounded from '@mui/icons-material/ScienceRounded';
import MusicNoteRounded from '@mui/icons-material/MusicNoteRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import CasinoRounded from '@mui/icons-material/CasinoRounded';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import PetsRounded from '@mui/icons-material/PetsRounded';
import FlightRounded from '@mui/icons-material/FlightRounded';
import CardGiftcardRounded from '@mui/icons-material/CardGiftcardRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import LeaderboardRounded from '@mui/icons-material/LeaderboardRounded';
import InfoRounded from '@mui/icons-material/InfoRounded';
import AlarmRounded from '@mui/icons-material/AlarmRounded';

export type IconComponent = React.ComponentType<SvgIconProps>;

/**
 * Maps an admin icon-name string to a Material icon component. Keep in sync
 * with the admin Categories page ICON_OPTIONS list — port of `iconByName`
 * in lib/data/category_catalog.dart, plus the reward/notification kind
 * icons the models expose by name.
 */
const REGISTRY: Record<string, IconComponent> = {
  // ---- Admin category icons ----
  sports_basketball: SportsBasketballRounded,
  currency_bitcoin: CurrencyBitcoinRounded,
  show_chart: ShowChartRounded,
  movie: MovieRounded,
  sports_esports: SportsEsportsRounded,
  how_to_vote: HowToVoteRounded,
  cloud: CloudRounded,
  science: ScienceRounded,
  music_note: MusicNoteRounded,
  public: PublicRounded,
  emoji_events: EmojiEventsRounded,
  star: StarRounded,
  bolt: BoltRounded,
  trending_up: TrendingUpRounded,
  casino: CasinoRounded,
  language: LanguageRounded,
  pets: PetsRounded,
  flight: FlightRounded,

  // ---- Reward-kind icons (RewardTxn.icon) ----
  card_giftcard: CardGiftcardRounded,
  check_circle: CheckCircleRounded,
  auto_awesome: AutoAwesomeRounded,

  // ---- Notification-kind icons (NotificationItem.icon) ----
  flag: FlagRounded,
  workspace_premium: WorkspacePremiumRounded,
  leaderboard: LeaderboardRounded,
  info: InfoRounded,
  alarm: AlarmRounded,
};

/** Falls back to the generic category glyph for any unknown name. */
export function iconByName(name: string): IconComponent {
  return REGISTRY[name] ?? CategoryRounded;
}

/** Renders a registry icon by name — `<Icon name="bolt" size={18} />`. */
export function Icon({
  name,
  size = 20,
  color,
  style,
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const Component = iconByName(name);
  return (
    <Component
      className={className}
      style={{ fontSize: size, color, ...style }}
      sx={{ fontSize: size }}
    />
  );
}
