import SmartImage from '@/components/ui/SmartImage';
import type { CastMember } from '@/lib/domain/models';

interface CastRailProps {
  cast: readonly CastMember[];
}

/** Past twenty faces nobody is still reading, and every one costs a headshot. */
const MAX_CAST = 20;

export default function CastRail({ cast }: CastRailProps) {
  const shown = cast.slice(0, MAX_CAST);
  if (shown.length === 0) return null;

  return (
    <ul className="rail">
      {shown.map((person, index) => (
        // The endpoint can credit one person twice (actor and crew), so the id
        // alone is not unique across the list.
        <li key={`${person.id}-${index}`} className="w-[6.5rem] sm:w-[7.5rem]">
          <div className="overflow-hidden rounded-card bg-surface-2 ring-1 ring-outline/60">
            <SmartImage
              src={person.profileUrl}
              alt={person.name}
              aspect="poster"
              sizes="120px"
            />
          </div>
          <p className="clamp-2 mt-2 text-sm font-medium leading-snug text-text-high">
            {person.name}
          </p>
          <p className="clamp-2 mt-0.5 text-xs leading-snug text-text-low">
            {person.character || person.department}
          </p>
        </li>
      ))}
    </ul>
  );
}
