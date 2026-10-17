import "server-only"

import { HttpError, unprocessable } from "./http"
import { MAX_HTML_BYTES, type PageInput } from "./store"

/** Reads the multipart page form: `file`, `name`, `display`, `designWidth`. */
export async function readPageForm(req: Request): Promise<PageInput> {
  const length = Number(req.headers.get("content-length") ?? 0)
  if (length > MAX_HTML_BYTES + 64 * 1024)
    throw new HttpError(413, "Die Datei ist zu groß (max. 25 MB).")
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw new HttpError(400, "Ungültige Anfrage.")
  }
  const file = form.get("file")
  const field = (k: string) => {
    const v = form.get(k)
    return typeof v === "string" ? v : undefined
  }
  const input: PageInput = {
    name: field("name"),
    display: field("display"),
    designWidth: field("designWidth"),
  }
  if (file !== null) {
    if (typeof file === "string")
      throw unprocessable("Bitte eine HTML-Datei auswählen.")
    if (file.size > MAX_HTML_BYTES)
      throw new HttpError(413, "Die Datei ist zu groß (max. 25 MB).")
    input.html = await file.text()
    input.fileName = file.name
  }
  return input
}
