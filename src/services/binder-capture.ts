/**
 * In-memory hand-off of a binder page photo from the camera screen to the
 * reading screen. Like capture-store.ts, the photo URI never goes into route
 * params (on web it is a multi-MB data URI); only a short id does. Only the
 * latest page is kept, and nothing is persisted.
 */

import type { BinderLayout, Rect } from './binder-grid.model';

export interface BinderCapture {
  id: string;
  uri: string;
  layout: BinderLayout;
  /** Page area in the photo: an exact rectangle, or "full" for an imported photo. */
  frame: Rect | 'full';
}

let last: BinderCapture | null = null;
let counter = 0;

export function setBinderCapture(capture: Omit<BinderCapture, 'id'>): string {
  counter += 1;
  const id = `${Date.now().toString(36)}-b${counter}`;
  last = { ...capture, id };
  return id;
}

export function getBinderCapture(id: string | undefined): BinderCapture | null {
  return id && last && last.id === id ? last : null;
}
