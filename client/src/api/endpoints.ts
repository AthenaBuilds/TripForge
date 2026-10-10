import type {
  CreateTripInput,
  ExportFormat,
  ItineraryItem,
  ItineraryItemInput,
  ItineraryItemPatch,
  LoginInput,
  ReplaceItemsInput,
  ShareInfo,
  SharedTrip,
  SignupInput,
  TripDetail,
  TripSummary,
  UpdateTripInput,
  User,
} from '@tripforge/shared';
import { api, apiDownload } from './client';

const json = (method: 'POST' | 'PATCH', body: unknown) => ({ method, body });

export const authApi = {
  me: () => api<{ user: User }>('/auth/me', { skipAuthRedirect: true }).then((d) => d.user),
  login: (input: LoginInput) =>
    api<{ user: User }>('/auth/login', { ...json('POST', input), skipAuthRedirect: true }).then(
      (d) => d.user,
    ),
  signup: (input: SignupInput) =>
    api<{ user: User }>('/auth/signup', { ...json('POST', input), skipAuthRedirect: true }).then(
      (d) => d.user,
    ),
  logout: () => api<void>('/auth/logout', { method: 'POST', skipAuthRedirect: true }),
};

export const tripsApi = {
  list: () => api<{ trips: TripSummary[] }>('/trips').then((d) => d.trips),
  get: (tripId: string) => api<{ trip: TripDetail }>(`/trips/${tripId}`).then((d) => d.trip),
  create: (input: CreateTripInput) =>
    api<{ trip: TripDetail }>('/trips', json('POST', input)).then((d) => d.trip),
  update: (tripId: string, input: UpdateTripInput) =>
    api<{ trip: TripDetail }>(`/trips/${tripId}`, json('PATCH', input)).then((d) => d.trip),
  remove: (tripId: string) => api<void>(`/trips/${tripId}`, { method: 'DELETE' }),
  /** Update Trip: replace the whole itinerary in one transaction. */
  replaceItems: (tripId: string, input: ReplaceItemsInput) =>
    api<{ trip: TripDetail }>(`/trips/${tripId}/items`, { method: 'PUT', body: input }).then(
      (d) => d.trip,
    ),
  exportFile: (tripId: string, format: ExportFormat) =>
    apiDownload(`/trips/${tripId}/export?format=${format}`),
  share: (tripId: string) => api<ShareInfo>(`/trips/${tripId}/share`, { method: 'POST' }),
  unshare: (tripId: string) => api<void>(`/trips/${tripId}/share`, { method: 'DELETE' }),
};

export const itemsApi = {
  create: (tripId: string, input: ItineraryItemInput) =>
    api<{ item: ItineraryItem }>(`/trips/${tripId}/items`, json('POST', input)).then((d) => d.item),
  update: (tripId: string, itemId: string, patch: ItineraryItemPatch) =>
    api<{ item: ItineraryItem }>(`/trips/${tripId}/items/${itemId}`, json('PATCH', patch)).then(
      (d) => d.item,
    ),
  remove: (tripId: string, itemId: string) =>
    api<void>(`/trips/${tripId}/items/${itemId}`, { method: 'DELETE' }),
};

export const sharedApi = {
  get: (slug: string) =>
    api<{ trip: SharedTrip }>(`/shared/${encodeURIComponent(slug)}`, {
      skipAuthRedirect: true,
    }).then((d) => d.trip),
  exportFile: (slug: string, format: ExportFormat) =>
    apiDownload(`/shared/${encodeURIComponent(slug)}/export?format=${format}`, {
      skipAuthRedirect: true,
    }),
};

export const queryKeys = {
  me: ['me'] as const,
  trips: ['trips'] as const,
  trip: (tripId: string) => ['trips', tripId] as const,
  shared: (slug: string) => ['shared', slug] as const,
};
