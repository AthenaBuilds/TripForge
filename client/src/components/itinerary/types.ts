/** An item as the list displays it: a saved item (key = id) or a draft item (key = clientId). */
export type ListItem = {
  key: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  city: string | null;
  location: string | null;
  notes: string | null;
};

/** Normalized form values; empty optional fields are null. */
export type ItemValues = Omit<ListItem, 'key'>;

export function toListItem(
  key: string,
  item: Partial<ItemValues> & Pick<ItemValues, 'title' | 'date'>,
): ListItem {
  return {
    key,
    title: item.title,
    date: item.date,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    city: item.city ?? null,
    location: item.location ?? null,
    notes: item.notes ?? null,
  };
}

/** Contract order (api-contract-spec §2): date, startTime (untimed first), then insertion order. */
export function sortItems<T extends Pick<ListItem, 'date' | 'startTime'>>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.date !== b.item.date) return a.item.date < b.item.date ? -1 : 1;
      const at = a.item.startTime ?? '';
      const bt = b.item.startTime ?? '';
      if (at !== bt) return at < bt ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/** Distinct non-empty cities, in first-seen order. */
export function distinctCities(items: Array<Pick<ListItem, 'city'>>): string[] {
  return [...new Set(items.map((i) => i.city?.trim()).filter((c): c is string => !!c))];
}
