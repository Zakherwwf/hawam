/**
 * Hawem design system v3.1 (docs/DESIGN.md). Palette sampled from the
 * reference boards in "inspirations for image to code": deep green #144513
 * and lime #B1EC6F (board 2), warm orange #F1721D and the sky/grass
 * illustration tones (board 4), gradient heroes (boards 1 and 3). Every text
 * colour passes WCAG AA on canvas and surface in both schemes
 * (test/hawem.test.ts).
 */
export interface HawemColors {
    canvas: string;
    surface: string;
    surfaceRaised: string;
    ink: string;
    ink2: string;
    ink3: string;
    hairline: string;
    accent: string;
    accentSoft: string;
    onAccent: string;
    danger: string;
    warning: string;
    cat: string;
    dog: string;
    /** Tinted backgrounds for the matching colour (destructive, warning, species) */
    dangerSoft: string;
    warningSoft: string;
    catSoft: string;
    dogSoft: string;
    /** Neutral control fill (segmented controls, empty progress tracks) */
    fill: string;
    /** Badge medallion tiers (data, like species colours) */
    bronze: string;
    silver: string;
    gold: string;
    /** Lime highlight (board 2): active bars, secondary buttons, selected states */
    lime: string;
    limeSoft: string;
    onLime: string;
    /** Warm orange (board 4): streaks, celebrations. warmInk is its text-safe shade */
    warm: string;
    warmSoft: string;
    warmInk: string;
}
export declare const hawemLight: HawemColors;
export declare const hawemDark: HawemColors;
export type HawemTypeStyle = {
    fontSize: number;
    lineHeight: number;
    fontWeight: '400' | '600' | '700';
};
export declare const hawemType: {
    largeTitle: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "700";
    };
    title1: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "700";
    };
    title2: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "700";
    };
    title3: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "600";
    };
    headline: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "600";
    };
    body: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "400";
    };
    callout: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "400";
    };
    subhead: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "400";
    };
    footnote: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "400";
    };
    caption: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "400";
    };
};
export declare const hawemSpace: {
    readonly xxs: 4;
    readonly xs: 8;
    readonly sm: 12;
    readonly md: 16;
    readonly lg: 20;
    readonly xl: 24;
    readonly xxl: 32;
    readonly xxxl: 48;
    readonly gutter: 20;
};
export declare const hawemRadius: {
    readonly sm: 12;
    readonly lg: 22;
    readonly xl: 28;
    readonly pill: 999;
};
export declare const hawemTouch: {
    readonly min: 44;
};
/**
 * Gradients, top to bottom (or start to end). Heroes carry white text only on
 * their darker first two stops; the last stop fades towards the canvas.
 */
export declare const hawemGradients: {
    readonly light: {
        readonly hero: readonly ["#144513", "#2F7A2B", "#8FD45C"];
        readonly lime: readonly ["#C9F28F", "#B1EC6F"];
        readonly sky: readonly ["#A6E2F9", "#E3F6FD"];
        readonly sunrise: readonly ["#F25A30", "#F1721D", "#FBDFC6"];
        readonly ocean: readonly ["#3865CC", "#68A5E0", "#A8E6E1"];
        readonly gold: readonly ["#F6D66B", "#D9A826"];
        readonly silver: readonly ["#E4E8EE", "#AEB6C2"];
        readonly bronze: readonly ["#F0B58A", "#B8733F"];
    };
    readonly dark: {
        readonly hero: readonly ["#0A230A", "#144513", "#2F7A2B"];
        readonly lime: readonly ["#B1EC6F", "#8FD45C"];
        readonly sky: readonly ["#12324A", "#0B0D0B"];
        readonly sunrise: readonly ["#8A2C14", "#B4520D", "#3A2210"];
        readonly ocean: readonly ["#1C3A7A", "#2A5A9A", "#1F4E52"];
        readonly gold: readonly ["#F6D66B", "#C8961A"];
        readonly silver: readonly ["#E4E8EE", "#9AA3B0"];
        readonly bronze: readonly ["#F0B58A", "#A8652F"];
    };
};
