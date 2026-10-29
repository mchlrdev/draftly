import type { MetadataRoute } from "next"

// Drafts are unpublished client work: no crawler, search engine or AI bot is
// welcome anywhere. Every response also carries `X-Robots-Tag` (proxy.ts) and
// every page a robots meta tag, for crawlers that ignore this file.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } }
}
