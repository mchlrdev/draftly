#!/usr/bin/env node
// Paper frame → self-contained Draftly page.
//
// Served by Draftly at /agent/paper-to-html.mjs for agents (ADR 0004). Takes
// the JSX that Paper's MCP tool `get_jsx` returns for one artboard, plus the
// file's tokens (`get_tokens` with format "css"), and writes one HTML file with
// every image and Google font inlined, so Draftly accepts it (no http(s) URLs).
// Optionally uploads it to a one-time Draftly upload link.
//
//   node paper-to-html.mjs frame.jsx --tokens tokens.css --out page.html \
//     [--title "Home"] [--upload <url>] [--font "Family:700italic=./f.woff2"] \
//     [--max-image 2400] [--jpeg-quality 82] [--subsets latin,latin-ext] [--no-fonts]
//
// Node 18+, no dependencies. On macOS, large opaque images are shrunk with sips.

import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, extname, join } from "node:path"
import { pathToFileURL } from "node:url"

export const MAX_HTML_BYTES = 25 * 1024 * 1024

// ---------- JSX (the subset Paper emits) ----------

class ParseError extends Error {}

/** Parses the first JSX element in `source` (leading tool headers and the
 *  wrapping parentheses are skipped). */
export function parseJsx(source) {
  const start = source.search(/<[A-Za-z]/)
  if (start < 0) throw new ParseError("No JSX element found in the input.")
  const p = new Parser(source, start)
  return p.element()
}

class Parser {
  constructor(src, pos = 0) {
    this.src = src
    this.pos = pos
  }
  fail(msg) {
    const before = this.src.slice(0, this.pos)
    const line = before.split("\n").length
    throw new ParseError(`${msg} (line ${line}): ${JSON.stringify(this.src.slice(this.pos, this.pos + 40))}`)
  }
  peek(s) {
    return this.src.startsWith(s, this.pos)
  }
  eat(s) {
    if (!this.peek(s)) this.fail(`Expected ${JSON.stringify(s)}`)
    this.pos += s.length
  }
  ws() {
    while (this.pos < this.src.length) {
      if (/\s/.test(this.src[this.pos])) this.pos++
      else if (this.peek("/*")) {
        const end = this.src.indexOf("*/", this.pos + 2)
        this.pos = end < 0 ? this.src.length : end + 2
      } else if (this.peek("//")) {
        const end = this.src.indexOf("\n", this.pos)
        this.pos = end < 0 ? this.src.length : end + 1
      } else break
    }
  }
  name(pattern = /^[A-Za-z_$][\w$.:-]*/) {
    const m = pattern.exec(this.src.slice(this.pos, this.pos + 200))
    if (!m) this.fail("Expected a name")
    this.pos += m[0].length
    return m[0]
  }

  element() {
    this.eat("<")
    const tag = this.name()
    const attrs = []
    for (;;) {
      this.ws()
      if (this.peek("/>")) {
        this.pos += 2
        return { tag, attrs, children: [] }
      }
      if (this.peek(">")) {
        this.pos += 1
        break
      }
      if (this.peek("{")) this.fail("Spread attributes are not supported")
      const name = this.name()
      this.ws()
      if (!this.peek("=")) {
        attrs.push([name, true])
        continue
      }
      this.pos += 1
      this.ws()
      if (this.peek('"') || this.peek("'")) {
        const q = this.src[this.pos]
        const end = this.src.indexOf(q, this.pos + 1)
        if (end < 0) this.fail("Unterminated attribute")
        attrs.push([name, { raw: this.src.slice(this.pos + 1, end) }])
        this.pos = end + 1
      } else if (this.peek("{")) {
        this.pos += 1
        this.ws()
        const value = this.value()
        this.ws()
        this.eat("}")
        attrs.push([name, value])
      } else this.fail("Expected an attribute value")
    }
    const children = []
    for (;;) {
      if (this.pos >= this.src.length) this.fail(`Unclosed <${tag}>`)
      if (this.peek("</")) {
        this.pos += 2
        this.ws()
        const close = this.name()
        if (close !== tag) this.fail(`Expected </${tag}>, got </${close}>`)
        this.ws()
        this.eat(">")
        return { tag, attrs, children: normalizeChildren(children) }
      }
      if (this.peek("<")) children.push(this.element())
      else if (this.peek("{")) {
        this.pos += 1
        this.ws()
        if (this.peek("}")) {
          this.pos += 1 // {/* comment */}
          continue
        }
        const v = this.value()
        this.ws()
        this.eat("}")
        if (typeof v === "string" || typeof v === "number")
          children.push({ text: String(v) })
        else if (v !== null && v !== undefined && typeof v !== "boolean")
          this.fail("Only string or number expressions are supported as children")
      } else {
        const next = this.src.slice(this.pos).search(/[<{]/)
        const end = next < 0 ? this.src.length : this.pos + next
        children.push({ jsxText: this.src.slice(this.pos, end) })
        this.pos = end
      }
    }
  }

  /** A JS literal: string, template without ${}, number, bool, null, object, array. */
  value() {
    this.ws()
    const c = this.src[this.pos]
    if (c === '"' || c === "'") return this.string()
    if (c === "`") {
      const end = this.src.indexOf("`", this.pos + 1)
      if (end < 0) this.fail("Unterminated template literal")
      const body = this.src.slice(this.pos + 1, end)
      if (body.includes("${")) this.fail("Template expressions are not supported")
      this.pos = end + 1
      return body
    }
    if (c === "{") {
      this.pos += 1
      const obj = {}
      for (;;) {
        this.ws()
        if (this.peek("}")) {
          this.pos += 1
          return obj
        }
        let key
        if (this.peek('"') || this.peek("'")) key = this.string()
        else key = this.name(/^[A-Za-z_$][\w$]*/)
        this.ws()
        this.eat(":")
        obj[key] = this.value()
        this.ws()
        if (this.peek(",")) this.pos += 1
      }
    }
    if (c === "[") {
      this.pos += 1
      const arr = []
      for (;;) {
        this.ws()
        if (this.peek("]")) {
          this.pos += 1
          return arr
        }
        arr.push(this.value())
        this.ws()
        if (this.peek(",")) this.pos += 1
      }
    }
    const m = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(this.src.slice(this.pos, this.pos + 40))
    if (m) {
      this.pos += m[0].length
      return Number(m[0])
    }
    for (const [word, v] of [["true", true], ["false", false], ["null", null], ["undefined", undefined]]) {
      if (this.peek(word)) {
        this.pos += word.length
        return v
      }
    }
    this.fail("Unsupported expression")
  }

  string() {
    const q = this.src[this.pos]
    let out = ""
    this.pos += 1
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]
      if (ch === q) {
        this.pos += 1
        return out
      }
      if (ch === "\\") {
        const n = this.src[this.pos + 1]
        const simple = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" }
        if (n === "u") {
          const braced = /^\{([0-9a-f]+)\}/i.exec(this.src.slice(this.pos + 2, this.pos + 12))
          if (braced) {
            out += String.fromCodePoint(parseInt(braced[1], 16))
            this.pos += 2 + braced[0].length
          } else {
            out += String.fromCharCode(parseInt(this.src.slice(this.pos + 2, this.pos + 6), 16))
            this.pos += 6
          }
        } else if (n === "x") {
          out += String.fromCharCode(parseInt(this.src.slice(this.pos + 2, this.pos + 4), 16))
          this.pos += 4
        } else if (n === "\n") {
          this.pos += 2
        } else {
          out += n in simple ? simple[n] : n
          this.pos += 2
        }
        continue
      }
      out += ch
      this.pos += 1
    }
    this.fail("Unterminated string")
  }
}

/** JSX whitespace: lines are trimmed and joined with one space; blank lines vanish. */
function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  let out = ""
  lines.forEach((line, i) => {
    let s = line.replace(/\t/g, " ")
    if (i > 0) s = s.replace(/^ +/, "")
    if (i < lines.length - 1) s = s.replace(/ +$/, "")
    if (s) out += (out ? " " : "") + s
  })
  return out
}

function normalizeChildren(children) {
  const out = []
  for (const c of children) {
    if (c.jsxText !== undefined) {
      const t = jsxTextValue(c.jsxText)
      if (t) out.push({ html: t }) // JSX text is already HTML-ish (entities stay)
    } else out.push(c)
  }
  return out
}

// ---------- render ----------

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])
const UNITLESS = new Set([
  "animationIterationCount", "aspectRatio", "columnCount", "columns", "fillOpacity", "flex", "flexGrow",
  "flexShrink", "floodOpacity", "fontWeight", "gridArea", "gridColumn", "gridColumnEnd", "gridColumnStart",
  "gridRow", "gridRowEnd", "gridRowStart", "lineClamp", "lineHeight", "opacity", "order", "orphans",
  "scale", "stopOpacity", "strokeDashoffset", "strokeMiterlimit", "strokeOpacity", "strokeWidth",
  "tabSize", "widows", "zIndex", "zoom", "WebkitLineClamp",
])
// SVG attributes that are camelCase in the spec; every other camelCase prop is kebab-cased.
const SVG_CAMEL = new Set([
  "attributeName", "baseFrequency", "calcMode", "clipPathUnits", "diffuseConstant", "edgeMode",
  "filterUnits", "gradientTransform", "gradientUnits", "kernelMatrix", "kernelUnitLength", "keyPoints",
  "keySplines", "keyTimes", "lengthAdjust", "limitingConeAngle", "markerHeight", "markerUnits",
  "markerWidth", "maskContentUnits", "maskUnits", "numOctaves", "pathLength", "patternContentUnits",
  "patternTransform", "patternUnits", "pointsAtX", "pointsAtY", "pointsAtZ", "preserveAlpha",
  "preserveAspectRatio", "primitiveUnits", "refX", "refY", "repeatCount", "specularConstant",
  "specularExponent", "spreadMethod", "startOffset", "stdDeviation", "stitchTiles", "surfaceScale",
  "tableValues", "textLength", "viewBox", "xChannelSelector", "yChannelSelector",
])
const RENAMED = {
  className: "class",
  htmlFor: "for",
  xlinkHref: "xlink:href",
  xmlnsXlink: "xmlns:xlink",
  xmlSpace: "xml:space",
  xmlLang: "xml:lang",
}

const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())
const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

export function cssProperty(key) {
  if (key.startsWith("--")) return key
  if (/^(Webkit|Moz|O)[A-Z]/.test(key) || /^ms[A-Z]/.test(key)) return "-" + kebab(key[0].toLowerCase() + key.slice(1))
  return kebab(key)
}

export function styleToCss(style) {
  return Object.entries(style)
    .filter(([, v]) => v !== null && v !== undefined && v !== false && v !== "")
    .map(([k, v]) => {
      const value = typeof v === "number" && v !== 0 && !UNITLESS.has(k) && !k.startsWith("--") ? `${v}px` : String(v)
      return `${cssProperty(k)}: ${value}`
    })
    .join("; ")
}

function attrName(name, inSvg) {
  if (name in RENAMED) return RENAMED[name]
  if (/^(data|aria)-/.test(name)) return name
  if (inSvg) return SVG_CAMEL.has(name) ? name : kebab(name)
  return name.toLowerCase()
}

/** Renders the parsed tree to HTML. Calls `visitStyle` with every style object. */
export function renderNode(node, { inSvg = false, visitStyle } = {}) {
  if (node.html !== undefined) return node.html
  if (node.text !== undefined) return escText(node.text)
  const svg = inSvg || node.tag === "svg"
  let out = `<${node.tag}`
  for (const [name, value] of node.attrs) {
    if (name === "key" || name === "ref") continue
    const html = attrName(name, svg)
    if (name === "style" && value && typeof value === "object" && !("raw" in value)) {
      visitStyle?.(value)
      const css = styleToCss(value)
      if (css) out += ` style="${escAttr(css)}"`
    } else if (value === true) out += ` ${html}`
    else if (value === false || value === null || value === undefined) continue
    else if (typeof value === "object" && "raw" in value) out += ` ${html}="${value.raw.replace(/"/g, "&quot;")}"`
    else if (typeof value === "object") continue
    else out += ` ${html}="${escAttr(String(value))}"`
  }
  if (VOID.has(node.tag) && !svg) return out + ">"
  if (svg && node.children.length === 0) return out + " />"
  out += ">"
  for (const c of node.children) out += renderNode(c, { inSvg: svg, visitStyle })
  return out + `</${node.tag}>`
}

// ---------- tokens & fonts ----------

/** Tokens as CSS (`:root { … }`, or bare declarations) or JSON
 *  (`[{name, value}]`, `{ "--x": "v" }`, or a get_basic_info / get_tokens result). */
export function tokensToCss(text) {
  const t = text.trim()
  if (!t) return ""
  if (t.startsWith("{") || t.startsWith("[")) {
    let data
    try {
      data = JSON.parse(t)
    } catch {
      data = null
    }
    if (data !== null) {
      const items = findTokenItems(data)
      return `:root { ${items.map(([n, v]) => `${n}: ${v};`).join(" ")} }`
    }
  }
  return t.includes("{") ? t : `:root { ${t} }`
}

function findTokenItems(data) {
  if (Array.isArray(data))
    return data
      .filter((x) => x && typeof x.name === "string" && x.value !== undefined)
      .map((x) => [x.name.startsWith("--") ? x.name : `--${x.name}`, String(x.value)])
  if (data && typeof data === "object") {
    for (const key of ["tokens", "items"]) if (data[key]) return findTokenItems(data[key])
    return Object.entries(data)
      .filter(([k, v]) => k.startsWith("--") && (typeof v === "string" || typeof v === "number"))
      .map(([k, v]) => [k, String(v)])
  }
  return []
}

function tokenMap(css) {
  const map = new Map()
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) map.set(m[1], m[2].trim())
  return map
}

function resolveVars(value, tokens, depth = 0) {
  if (depth > 10) return value
  return String(value).replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name, fallback) =>
    tokens.has(name) ? resolveVars(tokens.get(name), tokens, depth + 1) : (fallback ?? "")
  )
}

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|emoji|math|fangsong|ui-[\w-]+|-apple-system|blinkmacsystemfont|inherit|initial|unset|revert)$/i
const WEIGHTS = { thin: 100, extralight: 200, light: 300, normal: 400, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }

/** Families with the weights and styles the page asks for. */
export function collectFonts(styles, tokens) {
  const fonts = new Map()
  for (const s of styles) {
    if (!s.fontFamily) continue
    const families = resolveVars(s.fontFamily, tokens)
      .split(",")
      .map((f) => f.trim().replace(/^["']|["']$/g, ""))
      .filter((f) => f && !GENERIC.test(f))
    const rawWeight = s.fontWeight === undefined ? "400" : resolveVars(s.fontWeight, tokens).trim()
    const weight = Number(rawWeight) || WEIGHTS[rawWeight.toLowerCase()] || 400
    const italic = /italic|oblique/i.test(resolveVars(s.fontStyle ?? "", tokens))
    for (const family of families.slice(0, 1)) {
      if (!fonts.has(family)) fonts.set(family, new Set())
      fonts.get(family).add(`${italic ? 1 : 0},${Math.round(weight / 100) * 100}`)
    }
  }
  // Text nested in a styled parent inherits the family but may set only a
  // weight or style: add those combinations for every family.
  const extra = new Set()
  for (const s of styles) {
    if (s.fontFamily) continue
    if (s.fontWeight === undefined && s.fontStyle === undefined) continue
    const rawWeight = s.fontWeight === undefined ? "400" : resolveVars(s.fontWeight, tokens).trim()
    const weight = Number(rawWeight) || WEIGHTS[rawWeight.toLowerCase()] || 400
    const italic = /italic|oblique/i.test(resolveVars(s.fontStyle ?? "", tokens))
    extra.add(`${italic ? 1 : 0},${Math.round(weight / 100) * 100}`)
  }
  for (const set of fonts.values()) for (const e of extra) set.add(e)
  return fonts
}

const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "user-agent": CHROME_UA } })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" }
}

async function googleFontCss(family, combos, subsets, warn) {
  const name = encodeURIComponent(family).replace(/%20/g, "+")
  const get = async (axes) => {
    try {
      return (await fetchBuffer(`https://fonts.googleapis.com/css2?family=${name}:ital,wght@${axes}&display=swap`)).buf.toString("utf8")
    } catch {
      return null
    }
  }
  const sheets = []
  // Per style, ask for the whole weight range first: a variable font answers
  // with one file. A static font rejects ranges; then ask weight by weight.
  for (const ital of ["0", "1"]) {
    const weights = [...combos].filter((c) => c.startsWith(`${ital},`)).map((c) => Number(c.split(",")[1])).sort((a, b) => a - b)
    if (!weights.length) continue
    const lo = weights[0]
    const hi = weights[weights.length - 1]
    const ranged = lo < hi ? await get(`${ital},${lo}..${hi}`) : null
    if (ranged) {
      sheets.push(ranged)
      continue
    }
    for (const w of weights) {
      const css = await get(`${ital},${w}`)
      if (css) sheets.push(css)
      else warn(`Google Fonts has no ${family} ${w}${ital === "1" ? " italic" : ""}; the browser will synthesize it.`)
    }
  }
  const blocks = []
  for (const css of sheets)
    for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)) {
      if (subsets.length && !subsets.includes(m[1])) continue
      const src = /url\((https:[^)]+)\)/.exec(m[2])?.[1]
      if (src) blocks.push({ block: m[2], src })
    }
  return blocks
}

/** A variable font answers several weights with one file: embed it once,
 *  with a weight range. */
export function mergeWeights(blocks) {
  const groups = new Map()
  for (const b of blocks) {
    const style = /font-style:\s*(\w+)/.exec(b.block)?.[1]
    const key = `${b.src}|${style}`
    const weights = (/font-weight:\s*([\d ]+);/.exec(b.block)?.[1] ?? "400").trim().split(/\s+/).map(Number)
    const g = groups.get(key)
    if (g) g.weights.push(...weights)
    else groups.set(key, { ...b, weights })
  }
  return [...groups.values()].map(({ block, src, weights }) => {
    const lo = Math.min(...weights)
    const hi = Math.max(...weights)
    return { src, block: block.replace(/font-weight:\s*[\d ]+;/, `font-weight: ${lo === hi ? lo : `${lo} ${hi}`};`) }
  })
}

/** `Family[:weight][italic]=path` → an @font-face block with the file inlined. */
function localFontFace(spec) {
  const eq = spec.lastIndexOf("=")
  if (eq < 0) throw new Error(`--font expects Family[:weight][italic]=path, got ${spec}`)
  const [family, variant = "400"] = spec.slice(0, eq).split(":")
  const path = spec.slice(eq + 1)
  const weight = /\d+/.exec(variant)?.[0] ?? "400"
  const style = /italic/i.test(variant) ? "italic" : "normal"
  const ext = extname(path).slice(1).toLowerCase()
  const format = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }[ext] ?? ext
  const mime = { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" }[ext] ?? "application/octet-stream"
  const data = readFileSync(path).toString("base64")
  return { family, css: `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url(data:${mime};base64,${data}) format("${format}"); }` }
}

// ---------- images ----------

function sniffType(buf, header) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png"
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg"
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp"
  if (buf.slice(0, 6).toString() === "GIF87a" || buf.slice(0, 6).toString() === "GIF89a") return "image/gif"
  if (/^\s*(<\?xml|<svg)/.test(buf.slice(0, 200).toString())) return "image/svg+xml"
  if (buf.slice(4, 12).toString().includes("ftypavif")) return "image/avif"
  return header.split(";")[0].trim() || "application/octet-stream"
}

/** PNG colour types 4 and 6 carry alpha; palette PNGs may (tRNS). */
const pngHasAlpha = (buf) => [3, 4, 6].includes(buf[25]) || buf.includes(Buffer.from("tRNS"))

let sipsAvailable
function hasSips() {
  if (sipsAvailable === undefined) {
    try {
      execFileSync("sips", ["--help"], { stdio: "ignore" })
      sipsAvailable = true
    } catch {
      sipsAvailable = false
    }
  }
  return sipsAvailable
}

/** Shrinks big raster images with macOS sips: longest side ≤ maxDim, opaque PNGs → JPEG. */
function shrink(buf, type, { maxDim, jpegQuality }) {
  if (!hasSips() || !["image/png", "image/jpeg", "image/webp"].includes(type) || buf.length < 200_000)
    return { buf, type }
  const dir = mkdtempSync(join(tmpdir(), "paper-img-"))
  try {
    const input = join(dir, `in.${type.split("/")[1]}`)
    writeFileSync(input, buf)
    const info = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", input]).toString()
    const w = Number(/pixelWidth:\s*(\d+)/.exec(info)?.[1] ?? 0)
    const h = Number(/pixelHeight:\s*(\d+)/.exec(info)?.[1] ?? 0)
    const toJpeg = type !== "image/png" || !pngHasAlpha(buf)
    const outType = toJpeg ? "image/jpeg" : "image/png"
    const output = join(dir, toJpeg ? "out.jpg" : "out.png")
    const args = []
    if (Math.max(w, h) > maxDim) args.push("-Z", String(maxDim))
    if (toJpeg) args.push("-s", "format", "jpeg", "-s", "formatOptions", String(jpegQuality))
    if (!args.length) return { buf, type }
    execFileSync("sips", [...args, input, "--out", output], { stdio: "ignore" })
    const out = readFileSync(output)
    return out.length < buf.length ? { buf: out, type: outType } : { buf, type }
  } catch {
    return { buf, type }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const URL_RE = /https?:[^\s"'<>()]*/gi
const W3C = /^https?:\/\/www\.w3\.org\//i

/** Every http(s) URL Draftly would reject (W3C namespace ids aside). */
export function externalUrls(html) {
  return [...html.matchAll(URL_RE)].map((m) => m[0]).filter((u) => !W3C.test(u))
}

async function inlineImages(html, opts, warn) {
  const urls = [...new Set(externalUrls(html).map((u) => u.replace(/&amp;/g, "&")))]
  const map = new Map()
  await Promise.all(
    urls.map(async (url) => {
      try {
        const { buf, type } = await fetchBuffer(url)
        const shrunk = shrink(buf, sniffType(buf, type), opts)
        map.set(url, `data:${shrunk.type};base64,${shrunk.buf.toString("base64")}`)
      } catch (err) {
        warn(`Could not inline ${url}: ${err.message}`)
      }
    })
  )
  return html.replace(URL_RE, (u) => map.get(u.replace(/&amp;/g, "&")) ?? u)
}

// ---------- page ----------

/** HTML document around the rendered frame. Pure; no network. */
export function buildDocument(jsxSource, { tokensCss = "", title = "Page" } = {}) {
  const tree = parseJsx(jsxSource)
  const styles = []
  const body = renderNode(tree, { visitStyle: (s) => styles.push(s) })
  const rootStyle = tree.attrs.find(([n]) => n === "style")?.[1]
  const width = Number.parseInt(String(rootStyle?.width ?? ""), 10)
  const css = tokensToCss(tokensCss)
  const html = [
    "<!doctype html>",
    '<html lang="de">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta name="viewport" content="width=${Number.isFinite(width) ? width : "device-width"}">`,
    `<title>${escText(title)}</title>`,
    "<style>",
    css,
    "html, body { margin: 0; padding: 0; }",
    "p, h1, h2, h3, h4, h5, h6, ul, ol, figure, blockquote { margin: 0; }",
    "/*FONTS*/",
    "</style>",
    "</head>",
    `<body>${body}</body>`,
    "</html>",
    "",
  ].join("\n")
  return { html, styles, tokens: tokenMap(css), width: Number.isFinite(width) ? width : null }
}

export async function convert(jsxSource, options = {}) {
  const {
    tokensCss = "",
    title,
    fonts: fontSpecs = [],
    embedFonts = true,
    subsets = ["latin", "latin-ext"],
    maxDim = 2400,
    jpegQuality = 82,
    warn = (m) => console.warn(`warn: ${m}`),
  } = options
  const doc = buildDocument(jsxSource, { tokensCss, title })
  let html = await inlineImages(doc.html, { maxDim, jpegQuality }, warn)

  const faces = []
  const local = fontSpecs.map(localFontFace)
  for (const f of local) faces.push(f.css)
  if (embedFonts) {
    const localFamilies = new Set(local.map((f) => f.family.toLowerCase()))
    for (const [family, combos] of collectFonts(doc.styles, doc.tokens)) {
      if (localFamilies.has(family.toLowerCase())) continue
      const blocks = await googleFontCss(family, combos, subsets, warn)
      if (!blocks.length) {
        warn(`Font "${family}" is not on Google Fonts. Pass --font "${family}:400=./file.woff2" to embed it.`)
        continue
      }
      for (const { block, src } of mergeWeights(blocks)) {
        const { buf } = await fetchBuffer(src)
        faces.push(block.replace(src, `data:font/woff2;base64,${buf.toString("base64")}`))
      }
    }
  }
  html = html.replace("/*FONTS*/", faces.join("\n"))
  return { html, width: doc.width, bytes: Buffer.byteLength(html), external: externalUrls(html) }
}

export async function upload(url, html, { fileName = "page.html", name, display, designWidth } = {}) {
  const form = new FormData()
  form.set("file", new Blob([html], { type: "text/html" }), fileName)
  if (name) form.set("name", name)
  if (display) form.set("display", display)
  if (designWidth) form.set("designWidth", String(designWidth))
  const res = await fetch(url, { method: "POST", body: form })
  const text = await res.text()
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${text}`)
  return JSON.parse(text)
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { _: [], font: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) args._.push(a)
    else if (a === "--no-fonts") args.noFonts = true
    else if (a === "--font") args.font.push(argv[++i])
    else args[a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i]
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const [input] = args._
  if (!input) {
    console.error("Usage: node paper-to-html.mjs frame.jsx [--tokens tokens.css] [--out page.html] [--title T] [--upload URL] [--name N] [--display fixed|fill] [--font Family:700italic=path] [--max-image 2400] [--jpeg-quality 82] [--subsets latin,latin-ext] [--no-fonts]")
    process.exit(2)
  }
  const title = args.title ?? args.name ?? basename(input).replace(/\.[^.]+$/, "")
  const result = await convert(readFileSync(input, "utf8"), {
    tokensCss: args.tokens ? readFileSync(args.tokens, "utf8") : "",
    title,
    fonts: args.font,
    embedFonts: !args.noFonts,
    subsets: args.subsets ? args.subsets.split(",").filter(Boolean) : undefined,
    maxDim: args.maxImage ? Number(args.maxImage) : undefined,
    jpegQuality: args.jpegQuality ? Number(args.jpegQuality) : undefined,
  })
  const out = args.out ?? input.replace(/\.[^.]+$/, "") + ".html"
  writeFileSync(out, result.html)
  const mb = (result.bytes / 1024 / 1024).toFixed(1)
  console.log(`wrote ${out} (${mb} MB${result.width ? `, design width ${result.width}px` : ""})`)
  if (result.external.length) {
    console.error(`error: ${result.external.length} external URL(s) left, Draftly will reject the page: ${result.external.slice(0, 3).join(", ")}`)
    process.exit(1)
  }
  if (result.bytes > MAX_HTML_BYTES) {
    console.error("error: larger than Draftly's 25 MB limit. Retry with --max-image 1600 --jpeg-quality 72.")
    process.exit(1)
  }
  if (args.upload) {
    const page = await upload(args.upload, result.html, {
      fileName: basename(out),
      name: args.name,
      display: args.display,
      designWidth: args.designWidth ?? (args.display === "fill" ? undefined : result.width ?? undefined),
    })
    console.log(JSON.stringify({ uploaded: true, page }))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`error: ${err.message}`)
    process.exit(1)
  })
}
