import { useId, useState, type FormEvent } from 'react';
import { LIMITS, tripLengthDays } from '@tripforge/shared';
import type { DraftDetails } from '../../draft/DraftTripContext';

type FieldErrors = Partial<Record<keyof DraftDetails, string>>;

export function validateTripDetails(values: DraftDetails): FieldErrors {
  const errors: FieldErrors = {};
  const destination = values.destination.trim();
  if (!destination) errors.destination = 'Enter a destination.';
  else if (destination.length > LIMITS.destinationMax)
    errors.destination = `Use at most ${LIMITS.destinationMax} characters.`;
  if (!values.startDate) errors.startDate = 'Choose a start date.';
  if (!values.endDate) errors.endDate = 'Choose an end date.';
  if (values.startDate && values.endDate) {
    if (values.endDate < values.startDate)
      errors.endDate = 'The end date must be on or after the start date.';
    else if (tripLengthDays(values.startDate, values.endDate) > LIMITS.tripMaxDays)
      errors.endDate = `A trip can last at most ${LIMITS.tripMaxDays} days.`;
  }
  return errors;
}

type Props = {
  onSubmit: (details: DraftDetails) => void;
  initial?: DraftDetails;
  submitLabel?: string;
};

export function NewTripDetailsForm({ onSubmit, initial, submitLabel = 'Add Trip' }: Props) {
  const [values, setValues] = useState<DraftDetails>(
    initial ?? { destination: '', startDate: '', endDate: '' },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const id = useId();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateTripDetails(values);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({ ...values, destination: values.destination.trim() });
    }
  }

  const set = (name: keyof DraftDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  const errorProps = (name: keyof DraftDetails) => ({
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined,
  });

  const errorText = (name: keyof DraftDetails) =>
    errors[name] && (
      <p id={`${id}-${name}-error`} className="field-error">
        {errors[name]}
      </p>
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
      <div>
        <label htmlFor={`${id}-destination`} className="field-label">
          Destination
        </label>
        <input
          id={`${id}-destination`}
          className="field-input"
          placeholder="e.g. Goa or South India"
          value={values.destination}
          onChange={set('destination')}
          maxLength={LIMITS.destinationMax}
          {...errorProps('destination')}
        />
        {errorText('destination')}
      </div>
      <div>
        <label htmlFor={`${id}-startDate`} className="field-label">
          From Date
        </label>
        <input
          id={`${id}-startDate`}
          type="date"
          className="field-input"
          value={values.startDate}
          onChange={set('startDate')}
          {...errorProps('startDate')}
        />
        {errorText('startDate')}
      </div>
      <div>
        <label htmlFor={`${id}-endDate`} className="field-label">
          To Date
        </label>
        <input
          id={`${id}-endDate`}
          type="date"
          className="field-input"
          value={values.endDate}
          min={values.startDate || undefined}
          onChange={set('endDate')}
          {...errorProps('endDate')}
        />
        {errorText('endDate')}
      </div>
      <div className="sm:col-span-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
