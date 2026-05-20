export enum RSVPStatus {
  accepted = "accepted",
  declined = "declined",
  tentative = "tentative",
  pending = "pending",
}

export enum RSVPResponse {
  accepted = "accepted",
  declined = "declined",
  tentative = "tentative",
  pending = "pending",
}

export enum RepeatingFrequency {
  None = "none",
  Daily = "daily",
  Weekly = "weekly",
  Weekday = "weekdays",
  Monthly = "monthly",
  Quarterly = "quarterly",
  Yearly = "yearly",
}

export interface IParticipantRSVP {
  participantId: string;
  response: RSVPStatus;
  timestamp: number;
}

export interface IScheduledNotification {
  label: string;
  scheduledAt: number;
}

export type NotificationPreference = "enabled" | "disabled";

/**
 * Reference to a Formstr form attached to a calendar event.
 *
 * Stored on a private calendar event as a `form` tag:
 *   ["form", naddr, viewKey?]
 *
 * The naddr is the Nostr address (NIP-19) of the form.
 *
 * The optional viewKey is the form's read-only NIP-44 decryption key —
 * the same value Formstr surfaces in shareable links as `?viewKey=<hex>`
 * or inside an `#nkeys1...` bech32-TLV blob. It must NEVER be confused
 * with the form's `responseKey` (a.k.a. admin / edit key), which grants
 * write access to the form definition itself and must never be embedded
 * in shared calendar events.
 */
export interface IFormAttachment {
  naddr: string;
  viewKey?: string;
}

export interface IFormResponseAnswer {
  fieldId: string;
  label: string;
  value: string | string[] | number | boolean | null;
}

export interface IFormResponseSnapshot {
  submittedAt: number;
  answers: IFormResponseAnswer[];
}

export interface ICalendarEvent {
  begin: number;
  description: string;
  kind: number;
  end: number;
  id: string;
  eventId: string;
  title: string;
  createdAt: number;
  categories: string[];
  participants: string[];
  rsvpResponses: IParticipantRSVP[];
  reference: string[];
  image?: string;
  location: string[];
  geoHash: string[];
  website: string;
  user: string;
  isPrivateEvent: boolean;
  viewKey?: string;
  repeat: {
    rrule: string | null;
  };
  /**
   * Event-level notification preference.
   * If undefined, calendar-list preference should be used as fallback.
   */
  notificationPreference?: NotificationPreference;
  isInvitation?: boolean;
  relayHint?: string;
  /**
   * Forms attached to this event (Formstr).
   * Authors may attach one or more forms; participants are expected to
   * fill them when adding the event to their calendar.
   * Currently only persisted for private events.
   */
  forms?: IFormAttachment[];
  /** Optional snapshot copied from a booking-time form submission. */
  formResponse?: IFormResponseSnapshot;
}

// --- Appointment Scheduling Types ---

export type DurationMode = "fixed" | "free";

export interface IAvailabilityWindow {
  type: "recurring" | "date";
  dayOfWeek?: number;
  date?: string;
  startTime: string;
  endTime: string;
}

export interface ISchedulingPage {
  id: string;
  eventId: string;
  user: string;
  title: string;
  description: string;
  slotDurations: number[];
  durationMode: DurationMode;
  availabilityWindows: IAvailabilityWindow[];
  blockedDates: string[];
  timezone: string;
  minNotice: number;
  maxAdvance: number;
  buffer: number;
  expiry: number;
  location: string;
  image?: string;
  eventTitle?: string;
  relayHints?: string[];
  isPrivate?: boolean;
  viewKey?: string;
  createdAt: number;
  attachedForm?: IFormAttachment;
}

export type BookingRequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "expired"
  | "cancelled";

export interface IBookingRequest {
  id: string;
  giftWrapId: string;
  schedulingPageRef: string;
  bookerPubkey: string;
  start: number;
  end: number;
  title: string;
  note: string;
  dTag: string;
  receivedAt: number;
  status: BookingRequestStatus;
  respondedAt?: number;
  declineReason?: string;
  attachedForm?: IFormAttachment;
  formResponse?: IFormResponseSnapshot;
}

export interface IOutgoingBooking {
  id: string;
  giftWrapId: string;
  schedulingPageRef: string;
  creatorPubkey: string;
  start: number;
  end: number;
  title: string;
  note: string;
  sentAt: number;
  status: BookingRequestStatus;
  respondedAt?: number;
  declineReason?: string;
  eventRef?: string;
  dTag?: string;
  viewKey?: string;
  attachedForm?: IFormAttachment;
  formResponse?: IFormResponseSnapshot;
}

export interface ITimeSlot {
  start: Date;
  end: Date;
}
