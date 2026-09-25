export interface TextStyleToken {
    fontSize: number;
    lineHeight: number;
    fontWeight: '400' | '500' | '600' | '700';
    letterSpacing?: number;
}
export declare const typography: {
    readonly largeTitle: {
        readonly fontSize: 34;
        readonly lineHeight: 41;
        readonly fontWeight: "700";
        readonly letterSpacing: 0.37;
    };
    readonly title1: {
        readonly fontSize: 28;
        readonly lineHeight: 34;
        readonly fontWeight: "700";
        readonly letterSpacing: 0.36;
    };
    readonly title2: {
        readonly fontSize: 22;
        readonly lineHeight: 28;
        readonly fontWeight: "700";
        readonly letterSpacing: 0.35;
    };
    readonly title3: {
        readonly fontSize: 20;
        readonly lineHeight: 25;
        readonly fontWeight: "600";
        readonly letterSpacing: 0.38;
    };
    readonly headline: {
        readonly fontSize: 17;
        readonly lineHeight: 22;
        readonly fontWeight: "600";
        readonly letterSpacing: -0.41;
    };
    readonly body: {
        readonly fontSize: 17;
        readonly lineHeight: 22;
        readonly fontWeight: "400";
        readonly letterSpacing: -0.41;
    };
    readonly callout: {
        readonly fontSize: 16;
        readonly lineHeight: 21;
        readonly fontWeight: "400";
        readonly letterSpacing: -0.32;
    };
    readonly subhead: {
        readonly fontSize: 15;
        readonly lineHeight: 20;
        readonly fontWeight: "400";
        readonly letterSpacing: -0.24;
    };
    readonly footnote: {
        readonly fontSize: 13;
        readonly lineHeight: 18;
        readonly fontWeight: "400";
        readonly letterSpacing: -0.08;
    };
    readonly caption: {
        readonly fontSize: 12;
        readonly lineHeight: 16;
        readonly fontWeight: "400";
        readonly letterSpacing: 0;
    };
};
export type TypographyScale = typeof typography;
export type TypographyVariant = keyof TypographyScale;
