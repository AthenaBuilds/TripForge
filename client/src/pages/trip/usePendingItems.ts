import { useCallback, useMemo, useState } from 'react';
import type { ReplaceItemsInput } from '@tripforge/shared';
import type { ItemValues, ListItem } from '../../components/itinerary/types';

const NEW_PREFIX = 'new:';
const FIELDS = ['title', 'date', 'startTime', 'endTime', 'city', 'location', 'notes'] as const;

function sameValues(a: ItemValues, b: ItemValues): boolean {
  return FIELDS.every((f) => a[f] === b[f]);
}

/**
 * Unsaved item changes on /trips/:tripId (frontend-spec §5). Changes stay local until
 * `toRequest()` is sent with PUT /trips/:tripId/items ("Update Trip").
 */
export function usePendingItems(saved: ListItem[]) {
  const [pending, setPending] = useState<ListItem[] | null>(null);
  const items = pending ?? saved;

  const { statusByKey, added, edited, removed } = useMemo(() => {
    const savedByKey = new Map(saved.map((i) => [i.key, i]));
    const status = new Map<string, 'new' | 'edited'>();
    for (const item of items) {
      const original = savedByKey.get(item.key);
      if (!original) status.set(item.key, 'new');
      else if (!sameValues(original, item)) status.set(item.key, 'edited');
    }
    const keys = new Set(items.map((i) => i.key));
    const values = [...status.values()];
    return {
      statusByKey: status as ReadonlyMap<string, 'new' | 'edited'>,
      added: values.filter((s) => s === 'new').length,
      edited: values.filter((s) => s === 'edited').length,
      removed: saved.filter((i) => !keys.has(i.key)).length,
    };
  }, [items, saved]);

  const changeCount = added + edited + removed;

  const add = useCallback(
    (values: ItemValues) =>
      setPending((p) => [
        ...(p ?? saved),
        { key: `${NEW_PREFIX}${crypto.randomUUID()}`, ...values },
      ]),
    [saved],
  );
  const update = useCallback(
    (key: string, values: ItemValues) =>
      setPending((p) => (p ?? saved).map((i) => (i.key === key ? { key, ...values } : i))),
    [saved],
  );
  const remove = useCallback(
    (key: string) => setPending((p) => (p ?? saved).filter((i) => i.key !== key)),
    [saved],
  );
  const reset = useCallback(() => setPending(null), []);

  /** The request body, in the same order as `items` (so items[n] in errors maps back). */
  const toRequest = useCallback(
    (): ReplaceItemsInput => ({
      items: items.map(({ key, ...values }) =>
        key.startsWith(NEW_PREFIX) ? values : { id: key, ...values },
      ),
    }),
    [items],
  );

  return {
    items,
    statusByKey,
    summary: { added, edited, removed },
    isDirty: changeCount > 0,
    changeCount,
    add,
    update,
    remove,
    reset,
    toRequest,
  };
}
