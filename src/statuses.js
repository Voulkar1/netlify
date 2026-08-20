// Shared status vocabulary + validated status colors (see dataviz skill palette).
// Colors are the fixed "status" role (good/warning/serious/critical) plus two
// neutral/categorical hues for OFF and HOLIDAY, which aren't good/bad states.
export const STATUSES = {
  ON: {
    label: 'On Shift',
    short: 'ON',
    icon: '●',
    color: '#0ca30c',
    tint: '#e6f6e6',
    darkColor: '#0ca30c',
    darkTint: '#123312',
  },
  OFF: {
    label: 'Day Off',
    short: 'OFF',
    icon: '○',
    color: '#6b6a63',
    tint: '#eeeeec',
    darkColor: '#c3c2b7',
    darkTint: '#2a2a28',
  },
  HOLIDAY: {
    label: 'Holiday',
    short: 'HOL',
    icon: '★',
    color: '#2a78d6',
    tint: '#e7f0fc',
    darkColor: '#3987e5',
    darkTint: '#132a42',
  },
  LATE: {
    label: 'Late',
    short: 'LATE',
    icon: '◐',
    color: '#a66a00',
    tint: '#fdf1da',
    darkColor: '#fab219',
    darkTint: '#3a2a08',
  },
  MIA: {
    label: 'MIA',
    short: 'MIA',
    icon: '✕',
    color: '#d03b3b',
    tint: '#fbe7e6',
    darkColor: '#e66767',
    darkTint: '#3a1414',
  },
};

export const STATUS_ORDER = ['ON', 'OFF', 'HOLIDAY', 'LATE', 'MIA'];

export function isValidStatus(s) {
  return Object.prototype.hasOwnProperty.call(STATUSES, s);
}
