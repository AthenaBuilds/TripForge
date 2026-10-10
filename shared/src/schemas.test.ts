import { describe, expect, it } from 'vitest';
import {
  createTripInputSchema,
  replaceItemsInputSchema,
  exportQuerySchema,
  itineraryItemInputSchema,
  itineraryItemPatchSchema,
  signupInputSchema,
  updateTripInputSchema,
} from './schemas.ts';

describe('signupInputSchema', () => {
  it('trims the name and lowercases the email', () => {
    const parsed = signupInputSchema.parse({
      name: '  Asha Rao ',
      email: ' Asha@Example.COM ',
      password: 's3cretpass',
    });
    expect(parsed).toEqual({ name: 'Asha Rao', email: 'asha@example.com', password: 's3cretpass' });
  });

  it('rejects short passwords, bad emails, and unknown fields', () => {
    const base = { name: 'A', email: 'a@b.co', password: 's3cretpass' };
    expect(signupInputSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(signupInputSchema.safeParse({ ...base, password: 'x'.repeat(73) }).success).toBe(false);
    expect(signupInputSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
    expect(signupInputSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
    expect(signupInputSchema.safeParse({ ...base, isAdmin: true }).success).toBe(false);
  });
});

describe('itineraryItemInputSchema', () => {
  it('accepts a minimal item', () => {
    expect(itineraryItemInputSchema.parse({ title: 'Beach', date: '2026-12-20' })).toEqual({
      title: 'Beach',
      date: '2026-12-20',
    });
  });

  it('accepts nulls for optional fields', () => {
    const item = {
      title: 'Beach',
      date: '2026-12-20',
      startTime: null,
      endTime: null,
      city: null,
      location: null,
      notes: null,
    };
    expect(itineraryItemInputSchema.parse(item)).toEqual(item);
  });

  it('rejects bad formats and lengths', () => {
    const base = { title: 'Beach', date: '2026-12-20' };
    expect(itineraryItemInputSchema.safeParse({ ...base, date: '2026-02-30' }).success).toBe(false);
    expect(itineraryItemInputSchema.safeParse({ ...base, startTime: '7:00' }).success).toBe(false);
    expect(itineraryItemInputSchema.safeParse({ ...base, title: '' }).success).toBe(false);
    expect(itineraryItemInputSchema.safeParse({ ...base, notes: 'x'.repeat(1001) }).success).toBe(
      false,
    );
  });

  it('leaves start/end order to the service (422, not 400)', () => {
    const parsed = itineraryItemInputSchema.safeParse({
      title: 'Beach',
      date: '2026-12-20',
      startTime: '18:00',
      endTime: '09:00',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('itineraryItemPatchSchema', () => {
  it('accepts a partial update and null clears', () => {
    expect(itineraryItemPatchSchema.parse({ startTime: '08:00', notes: null })).toEqual({
      startTime: '08:00',
      notes: null,
    });
  });

  it('rejects an empty patch', () => {
    expect(itineraryItemPatchSchema.safeParse({}).success).toBe(false);
  });
});

describe('createTripInputSchema', () => {
  it('defaults items to an empty array', () => {
    const parsed = createTripInputSchema.parse({
      destination: ' Goa ',
      startDate: '2026-12-20',
      endDate: '2026-12-24',
    });
    expect(parsed).toEqual({
      destination: 'Goa',
      startDate: '2026-12-20',
      endDate: '2026-12-24',
      items: [],
    });
  });

  it('reports item errors with their index in the path', () => {
    const parsed = createTripInputSchema.safeParse({
      destination: 'Goa',
      startDate: '2026-12-20',
      endDate: '2026-12-24',
      items: [{ title: 'ok', date: '2026-12-20' }, { date: '2026-12-21' }],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['items', 1, 'title']);
  });
});

describe('updateTripInputSchema', () => {
  it('defaults shiftItems to false', () => {
    expect(updateTripInputSchema.parse({ destination: 'North Goa' })).toEqual({
      destination: 'North Goa',
      shiftItems: false,
    });
  });

  it('requires at least one trip field', () => {
    expect(updateTripInputSchema.safeParse({}).success).toBe(false);
    expect(updateTripInputSchema.safeParse({ shiftItems: true }).success).toBe(false);
  });
});

describe('exportQuerySchema', () => {
  it('accepts pdf and xlsx only', () => {
    expect(exportQuerySchema.safeParse({ format: 'pdf' }).success).toBe(true);
    expect(exportQuerySchema.safeParse({ format: 'xlsx' }).success).toBe(true);
    expect(exportQuerySchema.safeParse({ format: 'csv' }).success).toBe(false);
    expect(exportQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe('patch schemas with only unknown fields', () => {
  it('report just the unknown field, not "at least one field"', () => {
    const item = itineraryItemPatchSchema.safeParse({ tripId: 'x' });
    expect(item.error?.issues.map((i) => i.code)).toEqual(['unrecognized_keys']);
    const trip = updateTripInputSchema.safeParse({ userId: 'x' });
    expect(trip.error?.issues.map((i) => i.code)).toEqual(['unrecognized_keys']);
  });
});

describe('replaceItemsInputSchema', () => {
  const id = '5d1e9d3c-0a5b-4c1e-9b7a-1f2e3d4c5b6a';
  it('accepts items with and without ids, and an empty list', () => {
    expect(
      replaceItemsInputSchema.safeParse({
        items: [{ id, title: 'a', date: '2026-12-20' }, { title: 'b', date: '2026-12-21' }],
      }).success,
    ).toBe(true);
    expect(replaceItemsInputSchema.safeParse({ items: [] }).success).toBe(true);
  });

  it('rejects duplicate ids, bad ids, and unknown fields', () => {
    const dup = replaceItemsInputSchema.safeParse({
      items: [{ id, title: 'a', date: '2026-12-20' }, { id, title: 'b', date: '2026-12-21' }],
    });
    expect(dup.error?.issues[0]?.path).toEqual(['items', 1, 'id']);
    expect(replaceItemsInputSchema.safeParse({ items: [{ id: 'x', title: 'a', date: '2026-12-20' }] }).success).toBe(false);
    expect(replaceItemsInputSchema.safeParse({ items: [{ title: 'a', date: '2026-12-20', tripId: id }] }).success).toBe(false);
  });
});
