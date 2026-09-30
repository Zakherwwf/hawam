/**
 * Hawem design system v3 (docs/DESIGN.md). One action colour, flat surfaces,
 * SF type ladder. Every text colour passes WCAG AA on canvas and surface in
 * both schemes (test/hawem.test.ts).
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
    readonly sm: 10;
    readonly lg: 18;
    readonly pill: 999;
};
export declare const hawemTouch: {
    readonly min: 44;
};
