import { useId, useState, type FormEvent } from 'react';
import { LIMITS, isDateInRange } from '@tripforge/shared';
import { formatDay } from '../../lib/dates';
import { ErrorBanner } from '../ErrorBanner';
import type { ItemValues } from './types';

type Fields = Record<keyof ItemValues, string>;
type FieldErrors = Partial<Record<keyof ItemValues, string>>;

const EMPTY: Fields = {
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  city: '',
  location: '',
  notes: '',
};

export function validateItem(
  values: Fields,
  trip: { startDate: string; endDate: string },
): FieldErrors {
  const errors: FieldErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = 'Enter an activity.';
  else if (title.length > LIMITS.itemTitleMax)
    errors.title = `Use at most ${LIMITS.itemTitleMax} characters.`;
  if (!values.date) errors.date = 'Choose a date.';
  else if (!isDateInRange(values.date, trip.startDate, trip.endDate))
    errors.date = `Choose a date between ${formatDay(trip.startDate)} and ${formatDay(trip.endDate)}.`;
  if (values.startTime && values.endTime && values.startTime > values.endTime)
    errors.endTime = 'The end time must be at or after the start time.';
  if (values.city.trim().length > LIMITS.itemCityMax)
    errors.city = `Use at most ${LIMITS.itemCityMax} characters.`;
  if (values.location.trim().length > LIMITS.itemLocationMax)
    errors.location = `Use at most ${LIMITS.itemLocationMax} characters.`;
  if (values.notes.trim().length > LIMITS.itemNotesMax)
    errors.notes = `Use at most ${LIMITS.itemNotesMax} characters.`;
  return errors;
}

function normalize(values: Fields): ItemValues {
  const opt = (v: string) => v.trim() || null;
  return {
    title: values.title.trim(),
    date: values.date,
    startTime: values.startTime || null,
    endTime: values.endTime || null,
    city: opt(values.city),
    location: opt(values.location),
    notes: opt(values.notes),
  };
}

type Props = {
  trip: { startDate: string; endDate: string };
  /** Edit mode when set. */
  initial?: ItemValues;
  /** Add mode: City starts with the most recently added item's city (frontend-spec §4). */
  defaultCity?: string | null;
  /** Add mode: the date to start with (e.g. the last date used). */
  defaultDate?: string;
  citySuggestions: string[];
  /** May return a promise; the form shows a busy state and keeps values if it rejects. */
  onSubmit: (values: ItemValues) => void | Promise<void>;
  onCancel?: () => void;
  serverError?: string | null;
};

export function ItineraryItemForm({
  trip,
  initial,
  defaultCity,
  defaultDate,
  citySuggestions,
  onSubmit,
  onCancel,
  serverError,
}: Props) {
  const isEdit = !!initial;
  const blank = (): Fields => ({
    ...EMPTY,
    date: defaultDate ?? trip.startDate,
    city: defaultCity ?? '',
  });
  const [values, setValues] = useState<Fields>(() =>
    initial
      ? {
          title: initial.title,
          date: initial.date,
          startTime: initial.startTime ?? '',
          endTime: initial.endTime ?? '',
          city: initial.city ?? '',
          location: initial.location ?? '',
          notes: initial.notes ?? '',
        }
      : blank(),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const id = useId();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateItem(values, trip);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const item = normalize(values);
    setBusy(true);
    try {
      await onSubmit(item);
      // Ready for the next item: keep the date and city, clear the rest.
      if (!isEdit) setValues({ ...EMPTY, date: item.date, city: item.city ?? '' });
    } catch {
      // The parent shows serverError; keep what the user typed.
    } finally {
      setBusy(false);
    }
  }

  const set =
    (name: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value }));

  const fieldId = (name: keyof Fields) => `${id}-${name}`;
  const a11y = (name: keyof Fields) => ({
    id: fieldId(name),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${fieldId(name)}-error` : undefined,
  });
  const errorText = (name: keyof Fields) =>
    errors[name] && (
      <p id={`${fieldId(name)}-error`} className="field-error">
        {errors[name]}
      </p>
    );
  const label = (name: keyof Fields, text: string, optional = false) => (
    <label htmlFor={fieldId(name)} className="field-label">
      {text}
      {optional && <span className="font-normal text-slate-500"> (optional)</span>}
    </label>
  );

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={isEdit ? 'Edit item' : 'Add item'}
      className="grid gap-4 sm:grid-cols-6"
    >
      {serverError && (
        <div className="sm:col-span-6">
          <ErrorBanner>{serverError}</ErrorBanner>
        </div>
      )}
      <div className="sm:col-span-6">
        {label('title', 'Activity')}
        <input
          {...a11y('title')}
          className="field-input"
          placeholder="e.g. Dudhsagar Falls day trip"
          maxLength={LIMITS.itemTitleMax}
          value={values.title}
          onChange={set('title')}
        />
        {errorText('title')}
      </div>
      <div className="sm:col-span-2">
        {label('date', 'Date')}
        <input
          {...a11y('date')}
          type="date"
          className="field-input"
          min={trip.startDate}
          max={trip.endDate}
          value={values.date}
          onChange={set('date')}
        />
        {errorText('date')}
      </div>
      <div className="sm:col-span-2">
        {label('startTime', 'Start time', true)}
        <input
          {...a11y('startTime')}
          type="time"
          className="field-input"
          value={values.startTime}
          onChange={set('startTime')}
        />
        {errorText('startTime')}
      </div>
      <div className="sm:col-span-2">
        {label('endTime', 'End time', true)}
        <input
          {...a11y('endTime')}
          type="time"
          className="field-input"
          value={values.endTime}
          onChange={set('endTime')}
        />
        {errorText('endTime')}
      </div>
      <div className="sm:col-span-3">
        {label('city', 'City', true)}
        <input
          {...a11y('city')}
          className="field-input"
          list={`${id}-cities`}
          placeholder="e.g. Mysuru"
          maxLength={LIMITS.itemCityMax}
          value={values.city}
          onChange={set('city')}
        />
        <datalist id={`${id}-cities`}>
          {citySuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {errorText('city')}
      </div>
      <div className="sm:col-span-3">
        {label('location', 'Location', true)}
        <input
          {...a11y('location')}
          className="field-input"
          placeholder="Venue or address"
          maxLength={LIMITS.itemLocationMax}
          value={values.location}
          onChange={set('location')}
        />
        {errorText('location')}
      </div>
      <div className="sm:col-span-6">
        {label('notes', 'Notes', true)}
        <textarea
          {...a11y('notes')}
          className="field-input min-h-20"
          maxLength={LIMITS.itemNotesMax}
          value={values.notes}
          onChange={set('notes')}
        />
        {errorText('notes')}
      </div>
      <div className="flex flex-col gap-2 sm:col-span-6 sm:flex-row">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save item' : 'Add item'}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
