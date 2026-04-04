import { useSimulation } from '../context/SimulationContext';

/**
 * Renders a team's logo image from teams.json.
 * size: 'xs' (16px), 'sm' (20px), 'md' (28px), 'lg' (36px)
 */
export default function TeamLogo({ teamName, size = 'sm', className = '' }) {
  const { teamSlugMap, teamImages } = useSimulation();

  const slug = teamSlugMap[teamName];
  const imageUrl = slug ? teamImages[slug] : null;

  const sizeClass =
    size === 'xs'
      ? 'w-4 h-4'
      : size === 'sm'
      ? 'w-5 h-5'
      : size === 'md'
      ? 'w-7 h-7'
      : 'w-9 h-9';

  if (!imageUrl) {
    return (
      <span
        className={`${sizeClass} ${className} rounded-full bg-gray-200 inline-flex items-center justify-center text-gray-400 font-bold shrink-0`}
        style={{ fontSize: '0.5rem' }}
      >
        {teamName?.[0] ?? '?'}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={teamName}
      className={`${sizeClass} ${className} object-contain shrink-0`}
      onError={(e) => {
        e.target.style.display = 'none';
      }}
    />
  );
}
