import {
  lucideBaby,
  lucideCalendar,
  lucideClapperboard,
  lucideDices,
  lucideDrama,
  lucideFrame,
  lucideHammer,
  lucideHandHeart,
  lucideLeaf,
  lucideMic,
  lucideMusic,
  lucidePartyPopper,
  lucidePersonStanding,
  lucideTent,
  lucideTrees,
  lucideUtensils,
} from '@ng-icons/lucide';

/** The kind that Filtry shows as a switch rather than a tile: it narrows the other kinds instead of adding to them. */
export const KIDS_KIND = 'kids';

/** Each kind's Lucide icon, the same on Filtry's tiles, onboarding, the profile and the map's pins. */
const KIND_ICONS: Readonly<Record<string, string>> = {
  concerts: lucideMusic,
  stage: lucideDrama,
  cinema: lucideClapperboard,
  exhibitions: lucideFrame,
  talks: lucideMic,
  workshops: lucideHammer,
  nightlife: lucidePartyPopper,
  fairs: lucideTent,
  food: lucideUtensils,
  sports: lucidePersonStanding,
  wellbeing: lucideLeaf,
  outdoors: lucideTrees,
  kids: lucideBaby,
  games: lucideDices,
  causes: lucideHandHeart,
};

export const KIND_KEYS = Object.keys(KIND_ICONS);

/** A kind added to the database before the frontend knows its icon gets a plain one. */
export function kindIcon(key: string): string {
  return KIND_ICONS[key] ?? lucideCalendar;
}
