import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { NextRequest } from "next/server"
import { errorResponse, publicOrigin } from "@/lib/server/http"
import { createMcpServer } from "@/lib/server/mcp"
import { authenticateBearer } from "@/lib/server/tokens"

// Streamable HTTP MCP endpoint for agents (ADR 0004). Stateless: every POST
// gets its own server and transport, authenticated by
// `Authorization: Bearer dft_…` (a token from the operator's agent dialog).
// No server-initiated stream, so GET and DELETE answer 405.

async function mcp(req: NextRequest): Promise<Response> {
  const tokenId = authenticateBearer(req.headers.get("authorization"))
  if (!tokenId) {
    const res = errorResponse(401, "Ungültiges oder fehlendes API-Token.")
    res.headers.set("WWW-Authenticate", 'Bearer realm="draftly"')
    return res
  }
  const server = createMcpServer({ tokenId, origin: publicOrigin(req) })
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } catch (err) {
    console.error(err)
    return errorResponse(500, "Interner Fehler. Bitte später erneut versuchen.")
  }
}

export const POST = mcp

const notAllowed = () =>
  new Response(null, { status: 405, headers: { allow: "POST" } })
export const GET = notAllowed
export const DELETE = notAllowed
