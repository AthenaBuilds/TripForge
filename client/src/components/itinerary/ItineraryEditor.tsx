import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { ItineraryItemForm } from './ItineraryItemForm';
import { ItineraryItemList } from './ItineraryItemList';
import { distinctCities, type ItemValues, type ListItem } from './types';

type Props = {
  trip: { startDate: string; endDate: string };
  /** In the order they were added (used for the City default). */
  items: ListItem[];
  onAdd: (values: ItemValues) => void | Promise<void>;
  onUpdate: (key: string, values: ItemValues) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
  highlightedKeys?: ReadonlySet<string>;
  /** Errors from the last add / update, shown in the matching form. */
  addError?: string | null;
  editError?: string | null;
  onEditCancel?: () => void;
};

/**
 * The item-by-item builder shared by /trips/new/itinerary (draft) and /trips/:tripId (saved).
 * Add form on top, the day-grouped list below with inline edit and confirmed removal.
 */
export function ItineraryEditor({
  trip,
  items,
  onAdd,
  onUpdate,
  onRemove,
  highlightedKeys,
  addError,
  editError,
  onEditCancel,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ListItem | null>(null);
  const cities = useMemo(() => distinctCities(items), [items]);
  const last = items.at(-1);

  return (
    <div className="space-y-6">
      <section aria-labelledby="add-item-heading" className="card p-5">
        <h2 id="add-item-heading" className="mb-4 text-lg font-semibold">
          Add an item
        </h2>
        <ItineraryItemForm
          trip={trip}
          defaultCity={last?.city}
          defaultDate={last?.date}
          citySuggestions={cities}
          onSubmit={onAdd}
          serverError={addError}
        />
      </section>

      <section aria-labelledby="itinerary-heading">
        <h2 id="itinerary-heading" className="mb-3 text-lg font-semibold">
          Itinerary
        </h2>
        {items.length === 0 ? (
          <EmptyState title="No items yet">Add your first activity above.</EmptyState>
        ) : (
          <ItineraryItemList
            trip={trip}
            items={items}
            highlightedKeys={highlightedKeys}
            editingKey={editingKey}
            onEdit={(item) => setEditingKey(item.key)}
            onRemove={setRemoving}
            renderEditor={(item) => (
              <ItineraryItemForm
                trip={trip}
                initial={item}
                citySuggestions={cities}
                serverError={editError}
                onCancel={() => {
                  setEditingKey(null);
                  onEditCancel?.();
                }}
                onSubmit={async (values) => {
                  await onUpdate(item.key, values);
                  setEditingKey(null);
                }}
              />
            )}
          />
        )}
      </section>

      {removing && (
        <ConfirmDialog
          title="Remove this item?"
          onCancel={() => setRemoving(null)}
          actions={[
            {
              label: 'Remove',
              variant: 'danger',
              onClick: () => {
                const key = removing.key;
                setRemoving(null);
                void onRemove(key);
              },
            },
          ]}
        >
          <strong>{removing.title}</strong> will be removed from the itinerary.
        </ConfirmDialog>
      )}
    </div>
  );
}
