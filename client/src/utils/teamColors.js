// Distinct color palette for up to 8 selected teams
export const TEAM_COLORS = [
  {
    bg: 'bg-blue-600',
    text: 'text-blue-700',
    light: 'bg-blue-50',
    border: 'border-blue-500',
    badge: 'bg-blue-600 text-white',
    dot: 'bg-blue-600',
    header: 'bg-blue-600 text-white',
    row: 'bg-blue-50',
  },
  {
    bg: 'bg-rose-600',
    text: 'text-rose-700',
    light: 'bg-rose-50',
    border: 'border-rose-500',
    badge: 'bg-rose-600 text-white',
    dot: 'bg-rose-600',
    header: 'bg-rose-600 text-white',
    row: 'bg-rose-50',
  },
  {
    bg: 'bg-emerald-600',
    text: 'text-emerald-700',
    light: 'bg-emerald-50',
    border: 'border-emerald-500',
    badge: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-600',
    header: 'bg-emerald-600 text-white',
    row: 'bg-emerald-50',
  },
  {
    bg: 'bg-violet-600',
    text: 'text-violet-700',
    light: 'bg-violet-50',
    border: 'border-violet-500',
    badge: 'bg-violet-600 text-white',
    dot: 'bg-violet-600',
    header: 'bg-violet-600 text-white',
    row: 'bg-violet-50',
  },
  {
    bg: 'bg-amber-500',
    text: 'text-amber-700',
    light: 'bg-amber-50',
    border: 'border-amber-500',
    badge: 'bg-amber-500 text-white',
    dot: 'bg-amber-500',
    header: 'bg-amber-500 text-white',
    row: 'bg-amber-50',
  },
  {
    bg: 'bg-cyan-600',
    text: 'text-cyan-700',
    light: 'bg-cyan-50',
    border: 'border-cyan-500',
    badge: 'bg-cyan-600 text-white',
    dot: 'bg-cyan-600',
    header: 'bg-cyan-600 text-white',
    row: 'bg-cyan-50',
  },
  {
    bg: 'bg-fuchsia-600',
    text: 'text-fuchsia-700',
    light: 'bg-fuchsia-50',
    border: 'border-fuchsia-500',
    badge: 'bg-fuchsia-600 text-white',
    dot: 'bg-fuchsia-600',
    header: 'bg-fuchsia-600 text-white',
    row: 'bg-fuchsia-50',
  },
  {
    bg: 'bg-lime-600',
    text: 'text-lime-700',
    light: 'bg-lime-50',
    border: 'border-lime-500',
    badge: 'bg-lime-600 text-white',
    dot: 'bg-lime-600',
    header: 'bg-lime-600 text-white',
    row: 'bg-lime-50',
  },
];

export function getTeamColor(teamName, selectedTeams) {
  const idx = selectedTeams.indexOf(teamName);
  if (idx === -1) return null;
  return TEAM_COLORS[idx % TEAM_COLORS.length];
}
