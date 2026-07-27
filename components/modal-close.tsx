'use client';

import { createContext, useContext } from 'react';

/** Furnizat de un modal; `ActionForm` îl apelează la submit reușit ca să închidă modalul.
 *  null în afara oricărui modal → ActionForm nu face nimic. */
export const ModalCloseContext = createContext<(() => void) | null>(null);

export function useModalClose(): (() => void) | null {
  return useContext(ModalCloseContext);
}
