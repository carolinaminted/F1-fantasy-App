import { USAGE_LIMITS } from '../constants.ts';
import { calculateUsageRollup } from './scoringService.ts';
import {
  Constructor, Driver, EntityClass, PickSelection,
} from '../types.ts';

/**
 * Pre-submit validation for a lineup.
 *
 * This is a client-side gate, NOT a security boundary. `saveUserPicks` writes whatever it is
 * handed and `firestore.rules` accepts any write from the document's owner, so a crafted request
 * still lands. What this buys is that the app itself refuses a lineup the league rules forbid,
 * rather than relying on the picker having declined to offer it.
 *
 * Pure on purpose — no React, no Firestore — so the picks form and the admin override form can
 * both call it, and so the arithmetic can be reasoned about on its own.
 */

export type PickIssueCode = 'wrong-class' | 'inactive' | 'duplicate' | 'over-limit';

export interface PickIssue {
  code: PickIssueCode;
  entityId?: string;
  message: string;
}

/** Most severe first: a structurally invalid lineup matters more than an over-spent budget. */
const SEVERITY: Record<PickIssueCode, number> = {
  'wrong-class': 0,
  'inactive': 1,
  'duplicate': 2,
  'over-limit': 3,
};

type EntityType = 'teams' | 'drivers';

interface Bucket {
  ids: (string | null)[];
  type: EntityType;
  entityClass: EntityClass;
  label: string;
}

export interface ValidateLineupArgs {
  picks: PickSelection;
  eventId: string;
  seasonPicks: { [eventId: string]: PickSelection };
  cancelledEventIds?: Set<string>;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  /**
   * The lineup as already stored for this event. When given, an id that is unchanged in its slot
   * array is exempt from the class check: it was legal when it was made, and an entity that has
   * since changed class should not make a historical lineup uneditable. Admins editing past races
   * pass this; a member editing an upcoming race does not, because that lineup still has to be
   * fieldable under the current grid.
   */
  existingPicks?: PickSelection;
}

export const validateLineup = ({
  picks,
  eventId,
  seasonPicks,
  cancelledEventIds = new Set<string>(),
  allDrivers,
  allConstructors,
  existingPicks,
}: ValidateLineupArgs): PickIssue[] => {
  const issues: PickIssue[] = [];

  const storedBucket = (type: EntityType, entityClass: EntityClass): (string | null)[] => {
    if (!existingPicks) return [];
    if (type === 'teams') {
      return entityClass === EntityClass.A ? existingPicks.aTeams : [existingPicks.bTeam];
    }
    return entityClass === EntityClass.A ? existingPicks.aDrivers : existingPicks.bDrivers;
  };

  const buckets: Bucket[] = [
    { ids: picks.aTeams,   type: 'teams',   entityClass: EntityClass.A, label: 'Class A team' },
    { ids: [picks.bTeam],  type: 'teams',   entityClass: EntityClass.B, label: 'Class B team' },
    { ids: picks.aDrivers, type: 'drivers', entityClass: EntityClass.A, label: 'Class A driver' },
    { ids: picks.bDrivers, type: 'drivers', entityClass: EntityClass.B, label: 'Class B driver' },
  ];

  const find = (id: string, type: EntityType): Constructor | Driver | undefined =>
    (type === 'teams' ? allConstructors : allDrivers).find(e => e.id === id);

  const nameOf = (id: string, type: EntityType) => find(id, type)?.name ?? id;

  // --- 1. Wrong class / inactive -------------------------------------------------------------
  // The check that keeps the two budgets from leaking: a new pick can never land in a class
  // bucket the entity does not currently hold, so the slot array stays a truthful record of the
  // class each pick was made under.
  buckets.forEach(({ ids, type, entityClass, label }) => {
    ids.forEach(id => {
      if (!id) return;
      // Already stored in this same slot — legal when made, so its class is not re-litigated.
      if (storedBucket(type, entityClass).includes(id)) return;
      const entity = find(id, type);
      if (!entity) {
        issues.push({ code: 'wrong-class', entityId: id, message: `${id} is no longer on the grid and can't fill a ${label} slot.` });
        return;
      }
      if (entity.class !== entityClass) {
        issues.push({
          code: 'wrong-class',
          entityId: id,
          message: `${entity.name} is now Class ${entity.class} and can't fill a ${label} slot. Pick someone else for that slot.`,
        });
        return;
      }
      if (!entity.isActive) {
        issues.push({ code: 'inactive', entityId: id, message: `${entity.name} is not active this season and can't be picked.` });
      }
    });
  });

  if (picks.fastestLap) {
    const fl = find(picks.fastestLap, 'drivers');
    if (!fl) {
      issues.push({ code: 'wrong-class', entityId: picks.fastestLap, message: `${picks.fastestLap} is no longer on the grid and can't be your Fastest Lap pick.` });
    } else if (!fl.isActive) {
      issues.push({ code: 'inactive', entityId: fl.id, message: `${fl.name} is not active this season and can't be your Fastest Lap pick.` });
    }
  }

  // --- 2. Duplicates across the class pair ---------------------------------------------------
  // Teams and drivers are checked separately, and Fastest Lap is deliberately exempt: it draws
  // from the whole grid, spends no budget, and naming a driver you already picked is legal.
  (['teams', 'drivers'] as EntityType[]).forEach(type => {
    const seen = new Set<string>();
    buckets
      .filter(b => b.type === type)
      .flatMap(b => b.ids)
      .forEach(id => {
        if (!id) return;
        if (seen.has(id)) {
          issues.push({
            code: 'duplicate',
            entityId: id,
            message: `${nameOf(id, type)} is in this lineup twice. One selection per ${type === 'teams' ? 'team' : 'driver'} per race.`,
          });
        }
        seen.add(id);
      });
  });

  // --- 3. Over budget ------------------------------------------------------------------------
  // Picks for a cancelled event don't count against quotas, so there is nothing to enforce there.
  if (!cancelledEventIds.has(eventId)) {
    // The lineup being edited is already saved, so it has to come out of the baseline — otherwise
    // re-saving an at-limit lineup unchanged would be rejected.
    const baseline = calculateUsageRollup(seasonPicks, cancelledEventIds, eventId);

    buckets.forEach(({ ids, type, entityClass }) => {
      const counted = new Set<string>();
      ids.forEach(id => {
        if (!id || counted.has(id)) return;
        counted.add(id);
        const spent = baseline[type][id]?.[entityClass] ?? 0;
        const limit = USAGE_LIMITS[entityClass][type];
        if (spent + 1 > limit) {
          issues.push({
            code: 'over-limit',
            entityId: id,
            message: `${nameOf(id, type)} has no Class ${entityClass} selections left (${spent} of ${limit} used).`,
          });
        }
      });
    });
  }

  return issues.sort((a, b) => SEVERITY[a.code] - SEVERITY[b.code]);
};
