/**
 * Card geometry shared by the real components and their skeletons.
 *
 * This module deliberately imports nothing. The constants used to live in
 * `MovieRail`/`MovieGrid` and be imported by `Skeleton`, which closed a cycle
 * (`MovieRail` renders `RailSkeleton`). It survived only because both bindings
 * were read inside render functions rather than at module scope — the moment
 * either was used in a top-level expression, or `MovieRail` was route-split, it
 * would have become a `Cannot access before initialization` at runtime.
 *
 * A skeleton that does not reserve the exact box its content lands in is just a
 * layout shift with extra steps, so the two must stay in lockstep — hence one
 * leaf module both sides depend on.
 */

/**
 * Roughly 2.2 cards on a phone, five on a desktop — never a full card cut off.
 *
 * 34vw put a 2:3 poster at 109px on a 320px screen, which is too narrow for the
 * two-line title underneath. The phone step buys back ~15px per card; the fixed
 * step lands at 392px, where 39vw already equals 9.5rem, so the width does not
 * jump as the breakpoint crosses.
 */
export const RAIL_CARD_WIDTH =
  'w-[39vw] min-[24.5rem]:w-[9.5rem] sm:w-[10rem] lg:w-[10.75rem] xl:w-[11.75rem]';

/** Column ramp and gaps for every poster grid. */
export const GRID_CLASS =
  'grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-9 md:grid-cols-4 ' +
  'lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';
