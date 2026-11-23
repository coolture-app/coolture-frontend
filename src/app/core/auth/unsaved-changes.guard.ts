import { CanDeactivateFn } from '@angular/router';

/** A page that asks before its unsaved changes are lost: save and leave, leave without saving, or stay. */
export interface AsksBeforeLeaving {
  confirmLeave(): Promise<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<AsksBeforeLeaving> = (page) =>
  page.confirmLeave();
