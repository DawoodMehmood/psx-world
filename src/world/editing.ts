import { createContext } from 'react';

/** The dev-only asset editor sets this to show parts unmerged, so each one can be picked (see editDraft.ts). */
export const EditingContext = createContext(false);
