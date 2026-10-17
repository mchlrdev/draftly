"use client"

import { createContext, useContext } from "react"
import type { DraftAction } from "@/hooks/use-draft-state"
import type { DraftRef } from "@/lib/reviewer/api"

// What every part of the viewer needs to write: which draft, who is writing,
// and the reducer to apply the server's answer to.
export interface ViewerContextValue {
  draftRef: DraftRef
  dispatch: (action: DraftAction) => void
  operator: boolean
  clientId: string | null
  /** SHA-256 of clientId, matched against Comment.authorKey; null until computed. */
  authorKey: string | null
  /** The name from the password gate ("" when this browser has none). */
  authorName: string
}

const ViewerContext = createContext<ViewerContextValue | null>(null)

export const ViewerProvider = ViewerContext.Provider

export function useViewer() {
  const ctx = useContext(ViewerContext)
  if (!ctx) throw new Error("useViewer must be used inside the Viewer")
  return ctx
}
