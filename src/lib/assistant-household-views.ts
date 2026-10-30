import type { PiloteExpenseView } from "./pilote";

/** Fixed assistant scope requested by the owner, independent of the open Pilote tab. */
export const ASSISTANT_HOUSEHOLD_VIEWS = ["essential", "secondary"] as const satisfies readonly PiloteExpenseView[];
