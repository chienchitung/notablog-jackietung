import { createAgent } from 'notionapi-agent'

/** Adapt the legacy renderer to public Notion's current record API. */
export async function createPublicNotionAgent(sourceURL: string): Promise<ReturnType<typeof createAgent>> {
  const origin = new URL(sourceURL).origin
  const agent = createAgent({ server: origin })
  const runtimeFetch = (globalThis as unknown as {
    fetch: (url: string, options: unknown) => Promise<{
      ok: boolean; status: number; json: () => Promise<any>
    }>
  }).fetch
  const post = async (endpoint: string, body: unknown): Promise<any> => {
    const response = await runtimeFetch(`${origin}/api/v3/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const result = await response.json() as any
    if (!response.ok || result.errorId) {
      throw new Error(`Notion ${endpoint}: ${response.status} ${result.message || result.name || 'request failed'}`)
    }
    return result
  }
  const pageId = new URL(sourceURL).pathname.split('/').pop()!.split('-').pop()!
  const dashedId = pageId.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
  const initial = await post('loadCachedPageChunkV2', {
    page: { id: dashedId }, limit: 100, cursor: { stack: [] }, chunkNumber: 0,
    verticalColumns: false,
  })
  const initialBlocks = initial.recordMap?.block || {}
  const root = initialBlocks[dashedId]
  const rootValue = root?.value?.value || root?.value
  const spaceId = root?.spaceId || rootValue?.space_id
  if (!spaceId || !rootValue?.id) {
    throw new Error('Public Notion source is unavailable or has no workspace ID')
  }
  agent.getRecordValues = async (request: any) => {
    const result = await post('syncRecordValues', {
      requests: request.requests.map((pointer: any) => ({
        pointer: { ...pointer, spaceId }, version: -1,
      })),
    })
    return {
      results: request.requests.map((pointer: any) => {
        const record = result.recordMap?.[pointer.table]?.[pointer.id]
        if (!record) return { role: 'none' }
        return record.value && 'role' in record.value ? record.value : record
      }),
    }
  }
  agent.queryCollection = async (request: any) => post('queryCollection', {
    ...request,
    collection: { ...request.collection, spaceId },
    collectionView: { ...request.collectionView, spaceId },
  })
  agent.loadPageChunk = async (request: any) => post('loadPageChunk', request)
  return agent
}
