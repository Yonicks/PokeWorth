/** Copy and validation for the manual card entry screen. */

import { parseCollectorNumber } from '../services/card-matcher.service';

export type ManualEntryReason = 'ocr-unavailable' | 'no-text' | 'error' | 'permission';

const REASONS: ManualEntryReason[] = ['ocr-unavailable', 'no-text', 'error', 'permission'];

export function toManualEntryReason(value: unknown): ManualEntryReason | undefined {
  return typeof value === 'string' && (REASONS as string[]).includes(value)
    ? (value as ManualEntryReason)
    : undefined;
}

/** Short, user-facing explanation of why the user is entering details by hand. */
export function manualEntryMessage(reason: ManualEntryReason | undefined): string {
  switch (reason) {
    case 'ocr-unavailable':
      return 'Text recognition is not available in this version of the app. Type the card name and number you see on your card.';
    case 'no-text':
      return 'We could not read the name or number on this photo. Type them in below, or go back and try again with better lighting.';
    case 'error':
      return 'Something went wrong while reading the card. Type the card name and number below instead.';
    case 'permission':
      return 'Without camera access you can still look up a card by typing its name and number.';
    default:
      return 'Type the card name and the collector number printed at the bottom of the card.';
  }
}

export interface ManualEntryInput {
  name: string;
  number: string;
}

export interface ManualEntryErrors {
  name?: string;
  number?: string;
}

export interface ManualEntryValues {
  name: string;
  localId?: string;
  setTotal?: number;
}

/** Validate typed details; returns either field errors or values for /confirm. */
export function validateManualEntry(
  input: ManualEntryInput,
): { ok: true; values: ManualEntryValues } | { ok: false; errors: ManualEntryErrors } {
  const errors: ManualEntryErrors = {};
  const name = input.name.trim();
  const number = input.number.trim();

  // The catalog is searched by name, so a name is required.
  if (!name) errors.name = 'Enter the card name.';
  else if (name.length < 2) errors.name = 'The name needs at least 2 characters.';

  const parsedNumber = number ? parseCollectorNumber(number) : null;
  if (number && !parsedNumber) {
    errors.number = 'Use the number printed on the card, like 4/102, TG12/TG30 or SWSH284.';
  }

  if (errors.name || errors.number) return { ok: false, errors };
  return {
    ok: true,
    values: { name, localId: parsedNumber?.localId, setTotal: parsedNumber?.setTotal },
  };
}
