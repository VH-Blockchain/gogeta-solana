/**
 * Gradient helpers — port of lib/core/theme/app_gradients.dart (the pieces
 * the web portal actually uses).
 */
export const AppGradients = {
  /**
   * Vibrant, app-specific "Lucky Draw" gradient — a warm pink -> orange ->
   * yellow "sunset" diagonal for all lucky-draw surfaces; white foreground
   * reads cleanly over it.
   */
  lucky: 'linear-gradient(135deg, #FF4E8E 0%, #FF8A3D 52%, #FFC23D 100%)',
} as const;
