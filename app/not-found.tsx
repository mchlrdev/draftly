import type { Metadata } from "next"
import { CenteredCard, CardHeading } from "@/components/reviewer/centered-card"

export const metadata: Metadata = {
  title: "Nicht gefunden · Draftly",
  robots: { index: false, follow: false },
}

// Artboard "404". Unknown drafts, project-only URLs and `/` all land here,
// so the page never tells whether a slug exists.
export default function NotFound() {
  return (
    <CenteredCard>
      <CardHeading
        title="Hier ist nichts."
        subtitle="Prüfe den Link, den du bekommen hast."
      />
    </CenteredCard>
  )
}
