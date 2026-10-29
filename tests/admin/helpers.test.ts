import { describe, expect, it } from "vitest"
import { moveBy, moveTo, sameOrder } from "../../lib/admin/reorder"
import { slugProblem, slugify } from "../../lib/admin/slug"
import {
  paperFileIdFromInput,
  paperFromHtml,
  agentSetups,
  credentialsText,
  deleteDraftText,
  deleteProjectAction,
  deleteProjectText,
  designWidthProblem,
  designWidthValue,
  displayLabel,
  displayUrl,
  draftMeta,
  externalUrlMessage,
  fileSize,
  findExternalUrls,
  nameFromFilename,
  normalizeHex,
  projectMeta,
  relativeTime,
  shortUrl,
} from "../../lib/admin/format"

describe("slugProblem", () => {
  it("accepts a plain slug", () => {
    expect(slugProblem("tanjas-oase", "project")).toBeNull()
    expect(slugProblem("v4", "draft")).toBeNull()
  })
  it("says nothing while empty", () => {
    expect(slugProblem("", "project")).toBeNull()
  })
  it("rejects reserved project slugs only for projects", () => {
    expect(slugProblem("admin", "project")).toBe(
      "„admin“ und „api“ sind reserviert. Nimm einen anderen Slug."
    )
    expect(slugProblem("api", "project")).toMatch(/reserviert/)
    expect(slugProblem("admin", "draft")).toBeNull()
  })
  it("rejects bad characters and edge hyphens", () => {
    expect(slugProblem("Tanja", "project")).toBe(
      "Nur Kleinbuchstaben, Zahlen und Bindestriche."
    )
    expect(slugProblem("a b", "project")).toBe(
      "Nur Kleinbuchstaben, Zahlen und Bindestriche."
    )
    expect(slugProblem("-v4", "draft")).toBe(
      "Kein Bindestrich am Anfang oder Ende."
    )
    expect(slugProblem("v4-", "draft")).toBe(
      "Kein Bindestrich am Anfang oder Ende."
    )
  })
  it("rejects taken slugs", () => {
    expect(slugProblem("v4", "draft", ["v3", "v4"])).toBe(
      "Diesen Draft gibt es in diesem Projekt schon."
    )
    expect(slugProblem("oase", "project", ["oase"])).toBe(
      "Diesen Slug gibt es schon."
    )
  })
})

describe("slugify", () => {
  it("turns a title into a slug", () => {
    expect(slugify("Tanjas Wellness-Oase")).toBe("tanjas-wellness-oase")
    expect(slugify("  Größe & Übermut ")).toBe("groesse-uebermut")
    expect(slugify("Café")).toBe("cafe")
  })
})

describe("reorder", () => {
  const order = ["a", "b", "c"]
  it("moves up and down, clamped", () => {
    expect(moveBy(order, "b", -1)).toEqual(["b", "a", "c"])
    expect(moveBy(order, "b", 1)).toEqual(["a", "c", "b"])
    expect(moveBy(order, "a", -1)).toEqual(["a", "b", "c"])
    expect(moveBy(order, "c", 1)).toEqual(["a", "b", "c"])
  })
  it("moves to an index", () => {
    expect(moveTo(order, 0, 2)).toEqual(["b", "c", "a"])
    expect(moveTo(order, 2, 0)).toEqual(["c", "a", "b"])
    expect(moveTo(order, 5, 0)).toEqual(order)
  })
  it("does not mutate and compares", () => {
    moveBy(order, "a", 1)
    expect(order).toEqual(["a", "b", "c"])
    expect(sameOrder(order, ["a", "b", "c"])).toBe(true)
    expect(sameOrder(order, ["b", "a", "c"])).toBe(false)
  })
})

describe("format", () => {
  const now = new Date("2026-10-17T12:00:00Z")

  it("labels display modes", () => {
    expect(displayLabel({ display: "fixed", designWidth: 1440 })).toBe(
      "Fix · 1440"
    )
    expect(displayLabel({ display: "fill", designWidth: 1440 })).toBe("Fill")
  })

  it("writes relative times in German", () => {
    expect(relativeTime("2026-10-15T12:00:00Z", now)).toBe("vorgestern")
    expect(relativeTime("2026-10-14T11:00:00Z", now)).toBe("vor 3 Tagen")
    expect(relativeTime("2026-09-26T12:00:00Z", now)).toBe("vor 3 Wochen")
    expect(relativeTime("2026-10-17T11:59:30Z", now)).toBe("gerade eben")
  })

  it("builds row meta", () => {
    expect(
      projectMeta({ slug: "tanjas-oase", drafts: [{}, {}] as never })
    ).toBe("tanjas-oase · 2 Drafts")
    expect(projectMeta({ slug: "x", drafts: [{}] as never })).toBe(
      "x · 1 Draft"
    )
    const draft = {
      slug: "v4",
      projectSlug: "tanjas-oase",
      letterbox: "#D8D2C8",
      createdAt: "2026-10-14T11:00:00Z",
      pageCount: 2,
      openThreadCount: 3,
    }
    expect(draftMeta(draft, now)).toBe(
      "2 Seiten · 3 offene Kommentare · vor 3 Tagen"
    )
    expect(draftMeta({ ...draft, pageCount: 1, openThreadCount: 0 }, now)).toBe(
      "1 Seite · keine offenen Kommentare · vor 3 Tagen"
    )
  })

  it("shows and copies the draft link", () => {
    expect(displayUrl("https://draftly.mchlr.de/tanjas-oase/v4")).toBe(
      "draftly.mchlr.de/tanjas-oase/v4"
    )
    expect(credentialsText("https://d.de/a/b", "salbei-kiesel-7342")).toBe(
      "https://d.de/a/b\nPasswort: salbei-kiesel-7342"
    )
  })

  it("writes delete confirmations", () => {
    expect(
      deleteDraftText("https://draftly.mchlr.de/tanjas-oase/v4", {
        pageCount: 2,
        openThreadCount: 3,
      })
    ).toBe(
      "draftly.mchlr.de/tanjas-oase/v4 zeigt danach 404. Beide Seiten und 3 offene Kommentare sind weg."
    )
    expect(
      deleteDraftText("https://d.de/a/b", { pageCount: 0, openThreadCount: 0 })
    ).toBe("d.de/a/b zeigt danach 404. Alle Kommentare sind weg.")
    expect(deleteProjectText("Tanjas Wellness-Oase", 2)).toBe(
      "„Tanjas Wellness-Oase“ hat 2 Drafts. Danach sind alle Links, Seiten und Kommentare weg."
    )
    expect(deleteProjectAction(2)).toBe("Projekt und 2 Drafts löschen")
  })

  it("formats upload details", () => {
    expect(fileSize(184 * 1024)).toBe("184 KB")
    expect(fileSize(10)).toBe("1 KB")
    expect(nameFromFilename("angebot.html")).toBe("Angebot")
    expect(nameFromFilename("start-v2.html")).toBe("Start v2")
  })

  it("finds external URLs the server would reject", () => {
    const html = `<img src="https://app.paper.design/file/abc/hero.png"><a href='http://x.de'>x</a><p>data:image/png</p>`
    const urls = findExternalUrls(html)
    expect(urls).toEqual([
      "https://app.paper.design/file/abc/hero.png",
      "http://x.de",
    ])
    expect(shortUrl(urls[0])).toBe("https://app.paper.design/…/hero.png")
    expect(externalUrlMessage(urls)).toBe(
      "2 externe URLs gefunden, z. B. https://app.paper.design/…/hero.png. Bilder und Fonts bitte inline einbetten."
    )
    expect(findExternalUrls("<p>self-contained</p>")).toEqual([])
    expect(
      findExternalUrls(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>`
      )
    ).toEqual([])
  })

  it("normalises letterbox colours", () => {
    expect(normalizeHex("#d8d2c8")).toBe("#D8D2C8")
    expect(normalizeHex("abc")).toBe("#AABBCC")
    expect(normalizeHex("#D8D2C8FF")).toBe("#D8D2C8")
    expect(normalizeHex("rgb(0,0,0)")).toBeNull()
  })

  it("checks the design width", () => {
    expect(designWidthProblem("1440", "fixed")).toBeNull()
    expect(designWidthProblem("12.5", "fixed")).toBe(
      "Bitte eine ganze Zahl in px eingeben."
    )
    expect(designWidthProblem("100", "fixed")).toBe(
      "Bitte einen Wert zwischen 320 und 7680 px eingeben."
    )
    expect(designWidthProblem("", "fill")).toBeNull()
  })
})

describe("designWidthValue", () => {
  it("sends a valid width as entered", () => {
    expect(designWidthValue("1280")).toBe(1280)
  })
  it("falls back to the default for a width the Fill field hides", () => {
    expect(designWidthValue("100")).toBe(1440)
    expect(designWidthValue("")).toBe(1440)
  })
})

describe("agent setups", () => {
  const origin = "https://draftly.mchlr.de"
  const token = "dft_abc"
  const [claude, cursor, other] = agentSetups(origin, token)

  it("wire Claude Code, Cursor and any other agent to the MCP URL with the token", () => {
    expect(claude.snippet).toBe(
      'claude mcp add --scope user --transport http draftly https://draftly.mchlr.de/api/mcp --header "Authorization: Bearer dft_abc"'
    )
    expect(JSON.parse(cursor.snippet)).toEqual({
      mcpServers: {
        draftly: {
          url: "https://draftly.mchlr.de/api/mcp",
          headers: { Authorization: "Bearer dft_abc" },
        },
      },
    })
    expect(other.snippet).toBe(
      "URL:    https://draftly.mchlr.de/api/mcp\nHeader: Authorization: Bearer dft_abc"
    )
  })
})

describe("Paper link", () => {
  it("reads the converter's meta tags in any attribute order, skipping bad ids", () => {
    expect(
      paperFromHtml(
        '<head><meta content="1Y7-0" name="paper:node"><META NAME="paper:file" CONTENT="01M5"></head>'
      )
    ).toEqual({ paperFileId: "01M5", paperNodeId: "1Y7-0" })
    expect(paperFromHtml('<meta name="paper:node" content="a b">')).toEqual({})
    expect(paperFromHtml("<p>no meta</p>")).toEqual({})
  })

  it("takes a file id from a pasted Paper link", () => {
    expect(
      paperFileIdFromInput(
        "https://app.paper.design/file/01M587YHKH90P6BJ6TTPFZCXFW/p-3-0"
      )
    ).toBe("01M587YHKH90P6BJ6TTPFZCXFW")
    expect(paperFileIdFromInput(" 01M5 ")).toBe("01M5")
  })
})
