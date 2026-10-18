// File intake for page uploads (picker and drag and drop). Pure, so the
// rules can be unit-tested.

/** True for a file the upload accepts: `.html` / `.htm` or a `text/html` type. */
export function isHtmlFile(file: Pick<File, "name" | "type">): boolean {
  return /\.html?$/i.test(file.name) || file.type === "text/html"
}

/** Splits picked or dropped files into HTML pages and the names of the rest. */
export function splitHtmlFiles<F extends Pick<File, "name" | "type">>(
  files: Iterable<F>
): { html: F[]; skipped: string[] } {
  const html: F[] = []
  const skipped: string[] = []
  for (const file of files) {
    if (isHtmlFile(file)) html.push(file)
    else skipped.push(file.name)
  }
  return { html, skipped }
}

/** True while the drag carries files (not text or a link from the page). */
export function dragHasFiles(data: DataTransfer | null): boolean {
  return Boolean(data && Array.from(data.types).includes("Files"))
}

/** "„logo.png“ ist keine HTML-Datei …" for files a drop or pick left out. */
export function skippedFilesMessage(names: readonly string[]): string | null {
  if (names.length === 0) return null
  if (names.length === 1)
    return `„${names[0]}“ ist keine HTML-Datei und wurde übersprungen.`
  return `${names.length} Dateien sind keine HTML-Dateien und wurden übersprungen.`
}
