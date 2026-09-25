export interface ColorTokens {
    bg: string;
    bgElevated: string;
    surfaceGlass: string;
    label: string;
    labelSecondary: string;
    labelTertiary: string;
    separator: string;
    accent: string;
    accentContrast: string;
    cat: string;
    dog: string;
    success: string;
    warning: string;
    danger: string;
    gpsGood: string;
    gpsFair: string;
    gpsPoor: string;
    hudText: string;
    hudBg: string;
}
export declare const lightColors: ColorTokens;
export declare const darkColors: ColorTokens;
export declare const colors: {
    light: ColorTokens;
    dark: ColorTokens;
};
export declare function hexToRgb(hex: string): [number, number, number];
export declare function getRelativeLuminance(r: number, g: number, b: number): number;
export declare function getContrastRatio(foregroundHex: string, backgroundHex: string): number;
