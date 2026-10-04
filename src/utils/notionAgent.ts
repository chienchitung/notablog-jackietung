/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
// Notion's v3 API responses are untyped JSON.
import { createAgent } from 'notionapi-agent'

import { log } from './misc'

type NotionAgent = ReturnType<typeof createAgent>
type RecordPointer = { table: string; id: string }
type LegacyRecord = { role: string; value?: unknown }

const NOTION_SERVER = 'https://www.notion.so'
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const SYNC_BATCH_SIZE = 100

/** Node 18+ provides fetch; @types/node 16 does not declare it. */
const runtimeFetch = (
  globalThis as unknown as {
    fetch: (
      url: string,
      init: unknown
    ) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>
  }
).fetch

class NotionRequestError extends Error {
  status: number
  constructor(endpoint: string, status: number, detail: string) {
    super(`Notion ${endpoint} failed (${status}): ${detail}`)
    this.name = 'NotionRequestError'
    this.status = status
  }
}

/** Normalize a recordMap entry to the legacy `{ role, value }` shape. */
function toLegacyRecord(record: unknown): LegacyRecord {
  if (!record || typeof record !== 'object') return { role: 'none' }
  const entry = record as { role?: string; value?: unknown }
  const inner = entry.value as { role?: string; value?: unknown } | undefined
  if (
    inner &&
    typeof inner === 'object' &&
    'role' in inner &&
    'value' in inner
  ) {
    return { role: inner.role || 'reader', value: inner.value }
  }
  if (inner === undefined) return { role: 'none' }
  return { role: entry.role || 'reader', value: inner }
}

/**
 * Create a Notion agent that talks to the current v3 API.
 *
 * Notion now shards workspaces into cells. The legacy `getRecordValues`
 * endpoint cannot route to the right cell and fails with
 * MemcachedCrossCellError, so records are read with `syncRecordValues`
 * and every request carries the workspace (space) ID.
 */
export async function createNotionAgent(opts: {
  rootPageID: string
  token?: string
}): Promise<NotionAgent> {
  const workspace: { spaceId?: string } = {}

  const post = async (endpoint: string, body: unknown): Promise<any> => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': USER_AGENT,
      origin: NOTION_SERVER,
      referer: `${NOTION_SERVER}/`,
    }
    if (workspace.spaceId) headers['x-notion-space-id'] = workspace.spaceId
    if (opts.token) headers.cookie = `token_v2=${opts.token}`

    const response = await runtimeFetch(`${NOTION_SERVER}/api/v3/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })
    const text = await response.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      throw new NotionRequestError(
        endpoint,
        response.status,
        `non-JSON response: ${text.slice(0, 200)}`
      )
    }
    if (!response.ok || json.errorId) {
      throw new NotionRequestError(
        endpoint,
        response.status,
        `${String(json.name || 'Error')}: ${String(
          json.message || 'request failed'
        )}`
      )
    }
    return json
  }

  const loadPageChunk = (request: unknown) => post('loadPageChunk', request)

  /** Find the workspace that owns the root page. */
  const rootChunk = await loadPageChunk({
    pageId: opts.rootPageID,
    limit: 30,
    cursor: { stack: [] },
    chunkNumber: 0,
    verticalColumns: false,
  })
  const rootRecord = rootChunk.recordMap?.block?.[opts.rootPageID]
  const spaceId: string | undefined =
    rootRecord?.spaceId ||
    (toLegacyRecord(rootRecord).value as { space_id?: string })?.space_id
  if (!spaceId) {
    throw new Error(
      `Cannot find the Notion workspace of page "${opts.rootPageID}". Is the page published to the web?`
    )
  }
  workspace.spaceId = spaceId
  log.info(`Use Notion workspace ${spaceId}`)

  const getRecordValues = async (request: { requests: RecordPointer[] }) => {
    const results: LegacyRecord[] = []
    for (let i = 0; i < request.requests.length; i += SYNC_BATCH_SIZE) {
      const batch = request.requests.slice(i, i + SYNC_BATCH_SIZE)
      const response = await post('syncRecordValues', {
        requests: batch.map(pointer => ({
          pointer: { table: pointer.table, id: pointer.id, spaceId },
          version: -1,
        })),
      })
      for (const pointer of batch) {
        results.push(
          toLegacyRecord(response.recordMap?.[pointer.table]?.[pointer.id])
        )
      }
    }
    return { results }
  }

  const queryCollection = (request: {
    collection: Record<string, unknown>
    collectionView: Record<string, unknown>
  }) =>
    post('queryCollection', {
      ...request,
      collection: { ...request.collection, spaceId },
      collectionView: { ...request.collectionView, spaceId },
    })

  const agent = {
    ...createAgent({ token: opts.token }),
    getRecordValues,
    queryCollection,
    loadPageChunk,
  } as unknown as NotionAgent

  /**
   * nast-util-from-notionapi creates its own default agent to resolve user
   * and page mentions; patches/patch-nast-util.cjs makes it use this one.
   */
  ;(
    globalThis as { __notablogNotionAgent?: NotionAgent }
  ).__notablogNotionAgent = agent

  return agent
}
