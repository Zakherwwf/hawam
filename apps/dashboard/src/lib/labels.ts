/** Plain-language names for database codes, shared by every page. */
export const SPECIES_LABEL: Record<string, string> = {
  cat: 'Cat',
  dog: 'Dog',
  unknown: 'Unknown',
  mixed: 'Mixed',
};
export const SPECIES_PLURAL: Record<string, string> = {
  cat: 'Cats',
  dog: 'Dogs',
  unknown: 'Unknown',
};

export const SEX_LABEL: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Not known',
};
export const AGE_LABEL: Record<string, string> = {
  adult: 'Adult',
  juvenile: 'Juvenile',
  young: 'Young',
  unknown: 'Not known',
};
export const TRISTATE_LABEL: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  unknown: 'Not known',
};
export const BCS_LABEL: Record<number, string> = {
  1: 'Very thin',
  2: 'Thin',
  3: 'Ideal',
  4: 'Overweight',
  5: 'Obese',
};
export const COAT_LABEL: Record<string, string> = {
  tabby: 'Tabby',
  bicolour_piebald: 'Two colours',
  tortoiseshell_calico: 'Tortoiseshell or calico',
  solid_black: 'All black',
  solid_other: 'One colour',
  other: 'Other',
};
export const SIDE_LABEL: Record<string, string> = {
  left_flank: 'Left side',
  right_flank: 'Right side',
  face: 'Face',
  other: 'Other view',
};
export const ROLE_LABEL: Record<string, string> = {
  volunteer: 'Volunteer',
  trained_surveyor: 'Trained surveyor',
  researcher: 'Researcher',
  admin: 'Admin',
};
export const LANG_LABEL: Record<string, string> = { ar: 'Arabic', fr: 'French', en: 'English' };

export const DIRECTION_LABEL: Record<string, string> = {
  as_drawn: 'One way, start to end',
  either: 'Either direction',
};
export const SIDE_RULE_LABEL: Record<string, string> = {
  both: 'Both sides',
  left: 'Left side only',
  right: 'Right side only',
};

export const pretty = (code: string | null | undefined, map?: Record<string, string>) => {
  if (code == null || code === '') return 'Not recorded';
  if (map?.[code]) return map[code];
  const s = code.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const speciesTone = (s: string) =>
  s === 'cat' ? ('cat' as const) : s === 'dog' ? ('dog' as const) : ('neutral' as const);
