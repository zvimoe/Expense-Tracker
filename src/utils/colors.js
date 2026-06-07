/**
 * 10-colour palette shared by all charts.
 * Same category index → same colour across the whole app.
 */
export const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
  '#84CC16', // lime-500
];

export const COLORS_TRANSPARENT = COLORS.map((c) => c + 'cc'); // ~80 % opacity
