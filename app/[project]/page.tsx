import { notFound } from "next/navigation"

// A project has no public table of contents: only full draft URLs exist.
export default function ProjectPage() {
  notFound()
}
