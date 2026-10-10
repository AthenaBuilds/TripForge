export const LIMITS = {
  nameMax: 60,
  passwordMin: 8,
  passwordMax: 72, // bcrypt's input limit
  destinationMax: 100,
  tripMaxDays: 60,
  itemsPerTripMax: 200,
  itemTitleMax: 120,
  itemCityMax: 80,
  itemLocationMax: 120,
  itemNotesMax: 1000,
} as const;
