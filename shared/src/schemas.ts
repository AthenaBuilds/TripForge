import { z } from 'zod';
import { isValidDate, isValidTime } from './dates.ts';
import { LIMITS } from './limits.ts';

// Format checks only. Cross-field business rules (date ranges, time order, item limits)
// are enforced by the server's services layer and return 422 codes, not 400.

// ---------- Primitives ----------

export const uuidSchema = z.uuid();
export const dateSchema = z
  .string()
  .refine(isValidDate, { message: 'must be a valid date in YYYY-MM-DD format' });
export const timeSchema = z
  .string()
  .refine(isValidTime, { message: 'must be a valid time in HH:mm format' });
const timestampSchema = z.iso.datetime();

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// ---------- Auth ----------

export const signupInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(LIMITS.nameMax),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax),
});

export const loginInputSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  // No length rules on login: a wrong-length password is just INVALID_CREDENTIALS.
  password: z.string().min(1).max(LIMITS.passwordMax),
});

export const userSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: z.string(),
  createdAt: timestampSchema,
});

// ---------- Itinerary items ----------

const itemFields = {
  title: z.string().trim().min(1).max(LIMITS.itemTitleMax),
  date: dateSchema,
  startTime: timeSchema.nullable().optional(),
  endTime: timeSchema.nullable().optional(),
  city: optionalText(LIMITS.itemCityMax),
  location: optionalText(LIMITS.itemLocationMax),
  notes: optionalText(LIMITS.itemNotesMax),
};

export const itineraryItemInputSchema = z.strictObject(itemFields);

export const itineraryItemPatchSchema = z
  .strictObject(itemFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field is required' });

export const itineraryItemSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  title: z.string(),
  date: dateSchema,
  startTime: timeSchema.nullable(),
  endTime: timeSchema.nullable(),
  city: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ---------- Trips ----------

const destinationSchema = z.string().trim().min(1).max(LIMITS.destinationMax);

export const createTripInputSchema = z.strictObject({
  destination: destinationSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  // No max here: going over the limit is 422 ITEM_LIMIT_REACHED (checked by the service).
  items: z.array(itineraryItemInputSchema).default([]),
});

export const updateTripInputSchema = z
  .strictObject({
    destination: destinationSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    shiftItems: z.boolean().default(false),
  })
  .refine(
    (v) => v.destination !== undefined || v.startDate !== undefined || v.endDate !== undefined,
    { message: 'at least one of destination, startDate, endDate is required' },
  );

export const tripSummarySchema = z.object({
  id: uuidSchema,
  destination: z.string(),
  startDate: dateSchema,
  endDate: dateSchema,
  itemCount: z.number().int().nonnegative(),
  isShared: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const tripDetailSchema = tripSummarySchema.omit({ itemCount: true, isShared: true }).extend({
  shareSlug: z.string().nullable(),
  sharedAt: timestampSchema.nullable(),
  items: z.array(itineraryItemSchema),
});

// ---------- Sharing ----------

export const shareInfoSchema = z.object({
  shareSlug: z.string(),
  sharedAt: timestampSchema,
});

export const sharedItemSchema = itineraryItemSchema.omit({
  id: true,
  tripId: true,
  createdAt: true,
  updatedAt: true,
});

export const sharedTripSchema = z.object({
  destination: z.string(),
  startDate: dateSchema,
  endDate: dateSchema,
  ownerName: z.string(),
  updatedAt: timestampSchema,
  items: z.array(sharedItemSchema),
});

// ---------- Params & query ----------

export const tripParamsSchema = z.object({ tripId: uuidSchema });
export const itemParamsSchema = z.object({ tripId: uuidSchema, itemId: uuidSchema });
export const shareSlugParamsSchema = z.object({ slug: z.string().min(1).max(64) });
export const exportQuerySchema = z.strictObject({ format: z.enum(['pdf', 'xlsx']) });

// ---------- Inferred types ----------

export type SignupInput = z.infer<typeof signupInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type User = z.infer<typeof userSchema>;
export type ItineraryItemInput = z.input<typeof itineraryItemInputSchema>;
export type ItineraryItemPatch = z.infer<typeof itineraryItemPatchSchema>;
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
export type CreateTripInput = z.input<typeof createTripInputSchema>;
export type UpdateTripInput = z.input<typeof updateTripInputSchema>;
export type TripSummary = z.infer<typeof tripSummarySchema>;
export type TripDetail = z.infer<typeof tripDetailSchema>;
export type ShareInfo = z.infer<typeof shareInfoSchema>;
export type SharedItem = z.infer<typeof sharedItemSchema>;
export type SharedTrip = z.infer<typeof sharedTripSchema>;
export type ExportFormat = z.infer<typeof exportQuerySchema>['format'];
