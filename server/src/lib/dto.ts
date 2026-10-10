import type { ItineraryItem, SharedTrip, TripDetail, TripSummary, User } from '@tripforge/shared';
import type {
  ItineraryItem as ItemRow,
  Trip as TripRow,
  User as UserRow,
} from '../generated/prisma/client.js';
import { fromDbDate } from './dates.js';

export function toUserDto(user: Pick<UserRow, 'id' | 'name' | 'email' | 'createdAt'>): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toItemDto(item: ItemRow): ItineraryItem {
  return {
    id: item.id,
    tripId: item.tripId,
    title: item.title,
    date: fromDbDate(item.date),
    startTime: item.startTime,
    endTime: item.endTime,
    city: item.city,
    location: item.location,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toTripSummaryDto(trip: TripRow & { _count: { items: number } }): TripSummary {
  return {
    id: trip.id,
    destination: trip.destination,
    startDate: fromDbDate(trip.startDate),
    endDate: fromDbDate(trip.endDate),
    itemCount: trip._count.items,
    isShared: trip.shareSlug !== null,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}

export function toTripDetailDto(trip: TripRow & { items: ItemRow[] }): TripDetail {
  return {
    id: trip.id,
    destination: trip.destination,
    startDate: fromDbDate(trip.startDate),
    endDate: fromDbDate(trip.endDate),
    shareSlug: trip.shareSlug,
    sharedAt: trip.sharedAt?.toISOString() ?? null,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    items: trip.items.map(toItemDto),
  };
}

export function toSharedTripDto(
  trip: TripRow & { user: { name: string }; items: ItemRow[] },
): SharedTrip {
  // Allowlist: no ids, userId, email, or timestamps other than updatedAt (backend-spec §7).
  return {
    destination: trip.destination,
    startDate: fromDbDate(trip.startDate),
    endDate: fromDbDate(trip.endDate),
    ownerName: trip.user.name,
    updatedAt: trip.updatedAt.toISOString(),
    items: trip.items.map((item) => ({
      title: item.title,
      date: fromDbDate(item.date),
      startTime: item.startTime,
      endTime: item.endTime,
      city: item.city,
      location: item.location,
      notes: item.notes,
    })),
  };
}
