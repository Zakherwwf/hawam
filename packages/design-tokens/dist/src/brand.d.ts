/**
 * Hawem brand palette: the single source of colour values for the mobile app.
 * apps/mobile re-exposes it as IOSColors (theme/ios.ts) and
 * DesignTokens.colors (design-system/tokens.ts); neither defines colours.
 *
 * Text colours are chosen for WCAG AA (>= 4.5:1) on every light surface below,
 * because the app is read outdoors in direct sunlight (test/brand.test.ts).
 */
export declare const brandGradients: {
    sunsetMesh: readonly ["#DD4B34", "#ED6C44", "#FBA567"];
    sunsetMeshSoft: readonly ["#E25841", "#EE7B53", "#FDBA78"];
    citronGlow: readonly ["#D9F944", "#B6EA22"];
    obsidianCard: readonly ["#18181B", "#0F172A"];
};
export declare const brandPalette: {
    systemBackground: string;
    secondarySystemBackground: string;
    tertiarySystemBackground: string;
    systemGroupedBackground: string;
    secondarySystemGroupedBackground: string;
    sunsetGradient: readonly ["#DD4B34", "#ED6C44", "#FBA567"];
    sunsetSoftGradient: readonly ["#E25841", "#EE7B53", "#FDBA78"];
    citronGlowGradient: readonly ["#D9F944", "#B6EA22"];
    obsidianGradient: readonly ["#18181B", "#0F172A"];
    citron: string;
    citronLight: string;
    citronDark: string;
    terracotta: string;
    terracottaLight: string;
    coral: string;
    coralLight: string;
    amberWarm: string;
    amberLight: string;
    obsidian: string;
    obsidianPill: string;
    label: string;
    secondaryLabel: string;
    tertiaryLabel: string;
    quaternaryLabel: string;
    separator: string;
    opaqueSeparator: string;
    systemFill: string;
    secondarySystemFill: string;
    tertiarySystemFill: string;
    quaternarySystemFill: string;
    systemBlue: string;
    systemTeal: string;
    systemGreen: string;
    systemIndigo: string;
    systemOrange: string;
    systemPink: string;
    systemPurple: string;
    systemRed: string;
    systemYellow: string;
    systemGray: string;
    systemGray2: string;
    systemGray3: string;
    systemGray4: string;
    systemGray5: string;
    systemGray6: string;
    tint: string;
    tintLight: string;
    tintDark: string;
    cat: string;
    catLight: string;
    dog: string;
    dogLight: string;
    emerald: string;
    emeraldLight: string;
    welfareAlert: string;
    welfareAlertLight: string;
    success: string;
    successLight: string;
    warning: string;
    warningLight: string;
    successText: string;
    warningText: string;
    dangerText: string;
    glassSurface: string;
    glassBorder: string;
    darkGlassSurface: string;
    darkGlassBorder: string;
};
export interface AppTheme {
    isNight: boolean;
    backgroundGradient: readonly [string, string, string];
    screenBg: string;
    cardBg: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    statusBarStyle: 'dark' | 'light';
    pillBg: string;
}
export declare const dayTheme: AppTheme;
export declare const nightTheme: AppTheme;
/** Light surfaces text is placed on; used by the contrast tests. */
export declare const lightSurfaces: string[];
