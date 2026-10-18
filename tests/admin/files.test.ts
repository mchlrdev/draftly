import { describe, expect, it } from "vitest"
import {
  dragHasFiles,
  isHtmlFile,
  skippedFilesMessage,
  splitHtmlFiles,
} from "../../lib/admin/files"

const f = (name: string, type = "") => ({ name, type })

describe("isHtmlFile", () => {
  it("accepts .html and .htm in any case", () => {
    expect(isHtmlFile(f("start.html"))).toBe(true)
    expect(isHtmlFile(f("Kontakt.HTM"))).toBe(true)
  })
  it("accepts a text/html type without the extension", () => {
    expect(isHtmlFile(f("export", "text/html"))).toBe(true)
  })
  it("rejects anything else", () => {
    expect(isHtmlFile(f("logo.png", "image/png"))).toBe(false)
    expect(isHtmlFile(f("start.html.zip"))).toBe(false)
  })
})

describe("splitHtmlFiles", () => {
  it("keeps the order of the HTML files and names the rest", () => {
    const files = [f("b.html"), f("logo.png"), f("a.htm"), f("notes.txt")]
    expect(splitHtmlFiles(files)).toEqual({
      html: [files[0], files[2]],
      skipped: ["logo.png", "notes.txt"],
    })
  })
})

describe("skippedFilesMessage", () => {
  it("says nothing when every file was HTML", () => {
    expect(skippedFilesMessage([])).toBeNull()
  })
  it("names a single file", () => {
    expect(skippedFilesMessage(["logo.png"])).toBe(
      "„logo.png“ ist keine HTML-Datei und wurde übersprungen."
    )
  })
  it("counts several", () => {
    expect(skippedFilesMessage(["a.png", "b.pdf"])).toBe(
      "2 Dateien sind keine HTML-Dateien und wurden übersprungen."
    )
  })
})

describe("dragHasFiles", () => {
  it("is true only for drags carrying files", () => {
    const drag = (types: string[]) => ({ types }) as unknown as DataTransfer
    expect(dragHasFiles(drag(["Files"]))).toBe(true)
    expect(dragHasFiles(drag(["text/plain"]))).toBe(false)
    expect(dragHasFiles(null)).toBe(false)
  })
})
