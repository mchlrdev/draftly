import { describe, expect, it } from "vitest"
import * as p2h from "../../public/agent/paper-to-html.mjs"

// The converter agents download from /agent/paper-to-html.mjs. Only the pure
// part (parse, render, tokens, fonts) is tested; fetching is not.

const {
  buildDocument,
  collectFonts,
  externalUrls,
  mergeWeights,
  styleToCss,
  tokensToCss,
} = p2h as {
  buildDocument: (
    jsx: string,
    o?: { tokensCss?: string; title?: string; paperNodeId?: string }
  ) => {
    html: string
    styles: Record<string, unknown>[]
    tokens: Map<string, string>
    width: number | null
  }
  collectFonts: (
    styles: Record<string, unknown>[],
    tokens: Map<string, string>
  ) => Map<string, Set<string>>
  externalUrls: (html: string) => string[]
  mergeWeights: (
    b: { block: string; src: string }[]
  ) => { block: string; src: string }[]
  styleToCss: (s: Record<string, unknown>) => string
  tokensToCss: (t: string) => string
}

const PAPER_OUTPUT = `{
  "file": { "id": "01M5", "name": "Kunde" }
}(
    <div style={{ backgroundColor: 'var(--bg)', display: 'flex', MozOsxFontSmoothing: 'grayscale', WebkitFontSmoothing: 'antialiased', width: '1440px', flexShrink: '0', zIndex: 2, marginTop: 8 }}>
      <div style={{ fontFamily: 'var(--heading)', fontStyle: 'italic', fontSize: '64px' }}>
        Was du
        mitbringst.
      </div>
      <img src="https://app.paper.design/file-assets/01M5/a.png" alt="Bild" style={{ width: '100%' }} />
      {/* note */}
      <span style={{ fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 500 }}>{"Ehrgeiz & <Mut>"}</span>
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="icon">
        <path d="M5 12h14" strokeWidth={1.5} strokeLinecap="round" fillRule="evenodd" />
        <linearGradient gradientUnits="userSpaceOnUse" />
      </svg>
      <div style={{ fontWeight: 700 }} />
    </div>
  )`

describe("paper-to-html", () => {
  it("renders Paper's JSX as plain HTML", () => {
    const { html, width } = buildDocument(PAPER_OUTPUT, {
      tokensCss: ':root { --bg: #fff; --heading: "Newsreader"; }',
      title: "Home & Co",
    })
    expect(width).toBe(1440)
    expect(html).toContain('<meta name="viewport" content="width=1440">')
    expect(html).toContain("<title>Home &amp; Co</title>")
    expect(html).toContain(":root { --bg: #fff;")
    expect(html).toContain(
      'style="background-color: var(--bg); display: flex; -moz-osx-font-smoothing: grayscale; -webkit-font-smoothing: antialiased; width: 1440px; flex-shrink: 0; z-index: 2; margin-top: 8px"'
    )
    expect(html).toContain(">Was du mitbringst.</div>")
    expect(html).toContain(
      '<img src="https://app.paper.design/file-assets/01M5/a.png" alt="Bild" style="width: 100%">'
    )
    expect(html).toContain("Ehrgeiz &amp; &lt;Mut&gt;</span>")
    expect(html).toContain(
      "font-family: &quot;Hanken Grotesk&quot;, sans-serif"
    )
    expect(html).toContain('class="icon"')
    expect(html).toContain(
      '<path d="M5 12h14" stroke-width="1.5" stroke-linecap="round" fill-rule="evenodd" />'
    )
    expect(html).toContain('<linearGradient gradientUnits="userSpaceOnUse" />')
    expect(html).toContain('<div style="font-weight: 700"></div>')
    expect(html).not.toContain("note")
  })

  it("links the page to its Paper file and artboard with meta tags", () => {
    const { html } = buildDocument(PAPER_OUTPUT, { paperNodeId: "1Y7-0" })
    expect(html).toContain('<meta name="paper:file" content="01M5">')
    expect(html).toContain('<meta name="paper:node" content="1Y7-0">')
    expect(
      buildDocument(PAPER_OUTPUT, { paperNodeId: "a b" }).html
    ).not.toContain("paper:node")
  })

  it("finds the URLs Draftly would reject, W3C namespaces aside", () => {
    const { html } = buildDocument(PAPER_OUTPUT)
    expect(externalUrls(html)).toEqual([
      "https://app.paper.design/file-assets/01M5/a.png",
    ])
  })

  it("collects font families, weights and styles through tokens", () => {
    const { styles, tokens } = buildDocument(PAPER_OUTPUT, {
      tokensCss: ':root { --heading: "Newsreader"; }',
    })
    const fonts = collectFonts(styles, tokens)
    expect([...fonts.keys()].sort()).toEqual(["Hanken Grotesk", "Newsreader"])
    // A bare weight on an element without a family applies to every family.
    expect([...fonts.get("Newsreader")!].sort()).toEqual(["0,700", "1,400"])
    expect([...fonts.get("Hanken Grotesk")!].sort()).toEqual(["0,500", "0,700"])
  })

  it("reads tokens as CSS, bare declarations or Paper JSON", () => {
    expect(tokensToCss("--a: 1px;")).toBe(":root { --a: 1px; }")
    expect(tokensToCss(":root { --a: 1px; }")).toBe(":root { --a: 1px; }")
    expect(
      tokensToCss(
        JSON.stringify({ tokens: { items: [{ name: "--a", value: "#fff" }] } })
      )
    ).toBe(":root { --a: #fff; }")
    expect(tokensToCss(JSON.stringify({ "--b": "2px" }))).toBe(
      ":root { --b: 2px; }"
    )
  })

  it("embeds one variable font file once, with a weight range", () => {
    const face = (w: number, src: string) => ({
      src,
      block: `@font-face { font-style: normal; font-weight: ${w}; src: url(${src}); }`,
    })
    const merged = mergeWeights([
      face(400, "https://f/a.woff2"),
      face(700, "https://f/a.woff2"),
      face(400, "https://f/b.woff2"),
    ])
    expect(merged.map((m) => m.block)).toEqual([
      "@font-face { font-style: normal; font-weight: 400 700; src: url(https://f/a.woff2); }",
      "@font-face { font-style: normal; font-weight: 400; src: url(https://f/b.woff2); }",
    ])
  })

  it("leaves unitless properties and custom properties alone", () => {
    expect(
      styleToCss({ lineHeight: 1.2, opacity: 0, width: 0, "--x": 3, top: 4 })
    ).toBe("line-height: 1.2; opacity: 0; width: 0; --x: 3; top: 4px")
  })

  it("reports where the JSX breaks", () => {
    expect(() => buildDocument("<div style={{ a: foo() }}></div>")).toThrow(
      /Unsupported expression \(line 1\)/
    )
    expect(() => buildDocument("<div><span></div>")).toThrow(
      /Expected <\/span>/
    )
  })
})
