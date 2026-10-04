// Probe Notion's API variants against the configured public site and report
// which ones work reliably. Read-only; prints a summary table and samples.
import fs from 'node:fs'

const config = JSON.parse(fs.readFileSync('notablog-starter/config.json', 'utf-8'))
const SITE = new URL(config.url).origin
const WWW = 'https://www.notion.so'
const ROUNDS = Number(process.env.PROBE_ROUNDS || 6)
const GAP_MS = Number(process.env.PROBE_GAP_MS || 3000)
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const rawId = new URL(config.url).pathname.split('/').pop().split('-').pop()
const PAGE_ID = rawId.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
const VIEW_RAW = new URL(config.url).searchParams.get('v') || ''
const VIEW_ID = VIEW_RAW.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')

const wait = ms => new Promise(r => setTimeout(r, ms))
const samples = new Map()

function unwrap(record) {
  if (!record) return undefined
  const v = record.value
  if (v && typeof v === 'object' && 'value' in v && 'role' in v) return v.value
  return v
}

function findKeys(obj, re, path = '', out = []) {
  if (!obj || typeof obj !== 'object' || out.length > 20) return out
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k
    if (re.test(k)) out.push([p, v])
    findKeys(v, re, p, out)
  }
  return out
}

async function call(host, endpoint, body, extraHeaders = {}) {
  const started = Date.now()
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'user-agent': UA,
    origin: host,
    referer: `${host}/`,
    ...extraHeaders,
  }
  let res
  try {
    res = await fetch(`${host}/api/v3/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
  } catch (error) {
    return { ok: false, kind: `network:${error.code || error.name}`, ms: Date.now() - started }
  }
  const text = await res.text()
  const notionHeaders = {}
  for (const [k, v] of res.headers) {
    if (/notion|cell|cf-ray|x-amz|server/i.test(k)) notionHeaders[k] = v
  }
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return {
      ok: false,
      kind: `non-json:${res.status}`,
      ms: Date.now() - started,
      status: res.status,
      headers: notionHeaders,
      text: text.slice(0, 300),
    }
  }
  const out = { status: res.status, ms: Date.now() - started, headers: notionHeaders, json }
  if (json.errorId || !res.ok) {
    return { ...out, ok: false, kind: `error:${json.name || res.status}`, message: json.message }
  }
  if (json.fanoutData) return { ...out, ok: false, kind: 'fanoutData' }
  return { ...out, ok: true, kind: 'ok' }
}

/** Discover spaceId, collection id and a few block ids. */
async function discover() {
  const info = { spaceId: undefined, collectionId: undefined, viewId: VIEW_ID, blockIds: [PAGE_ID] }
  const attempts = [
    [WWW, 'loadCachedPageChunkV2', { page: { id: PAGE_ID }, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }],
    [SITE, 'loadCachedPageChunkV2', { page: { id: PAGE_ID }, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }],
    [WWW, 'loadPageChunk', { pageId: PAGE_ID, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }],
    [SITE, 'loadPageChunk', { pageId: PAGE_ID, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }],
  ]
  for (const [host, ep, body] of attempts) {
    const r = await call(host, ep, body)
    console.log(`discover ${ep}@${host === WWW ? 'www' : 'site'}: ${r.kind} (${r.ms}ms)`)
    if (!r.ok) continue
    const blocks = r.json.recordMap?.block || {}
    const root = blocks[PAGE_ID]
    info.spaceId ||= root?.spaceId || unwrap(root)?.space_id
    const rootValue = unwrap(root)
    info.collectionId ||= rootValue?.collection_id || rootValue?.format?.collection_pointer?.id
    info.viewId ||= rootValue?.view_ids?.[0]
    const cols = Object.keys(r.json.recordMap?.collection || {})
    info.collectionId ||= cols[0]
    for (const id of Object.keys(blocks)) {
      if (info.blockIds.length < 5 && !info.blockIds.includes(id)) info.blockIds.push(id)
    }
    if (info.spaceId && info.collectionId) break
  }
  const domain = new URL(SITE).hostname.split('.')[0]
  const pd = await call(WWW, 'getPublicPageDataForDomain', {
    type: 'block-space', name: 'page', slug: '', spaceDomain: domain, requestedOnPublicDomain: true,
  })
  console.log(`discover getPublicPageDataForDomain@www: ${pd.kind}`)
  if (pd.json) console.log('  ', JSON.stringify(pd.json).slice(0, 400))
  info.spaceId ||= pd.json?.spaceId
  return info
}

function syncBody(info, ids, withSpace) {
  return {
    requests: ids.map(id => ({
      pointer: withSpace ? { table: 'block', id, spaceId: info.spaceId } : { table: 'block', id },
      version: -1,
    })),
  }
}

function queryBody(info, withSpace) {
  const s = withSpace ? { spaceId: info.spaceId } : {}
  return {
    collection: { id: info.collectionId, ...s },
    collectionView: { id: info.viewId, ...s },
    loader: {
      type: 'reducer',
      reducers: { pages: { type: 'results', limit: 50, loadContentCover: false } },
      searchQuery: '',
      userTimeZone: 'Asia/Taipei',
    },
  }
}

function checkSync(info) {
  return r => {
    const rec = r.json?.recordMap?.block?.[info.blockIds[0]]
    return unwrap(rec)?.id ? true : 'missing root block in recordMap'
  }
}
function checkLegacy(info) {
  return r => (r.json?.results?.[0] && unwrap(r.json.results[0])?.id ? true : 'empty results')
}
function checkQuery() {
  return r => {
    const ids = r.json?.result?.reducerResults?.pages?.blockIds || r.json?.result?.blockIds
    return ids?.length ? true : 'no rows returned'
  }
}
function checkChunk() {
  return r => (r.json?.recordMap?.block?.[PAGE_ID] ? true : 'root block missing')
}

function methods(info) {
  const sh = info.spaceId ? { 'x-notion-space-id': info.spaceId } : {}
  const legacyBody = { requests: info.blockIds.map(id => ({ table: 'block', id })) }
  return [
    ['A getRecordValues @www (legacy, original)', WWW, 'getRecordValues', legacyBody, {}, checkLegacy(info)],
    ['B getRecordValues @site (legacy, CURRENT)', SITE, 'getRecordValues', legacyBody, {}, checkLegacy(info)],
    ['C syncRecordValues @www +spaceId', WWW, 'syncRecordValues', syncBody(info, info.blockIds, true), {}, checkSync(info)],
    ['D syncRecordValues @www +spaceId +header', WWW, 'syncRecordValues', syncBody(info, info.blockIds, true), sh, checkSync(info)],
    ['E syncRecordValues @www no spaceId', WWW, 'syncRecordValues', syncBody(info, info.blockIds, false), {}, checkSync(info)],
    ['F syncRecordValues @site +spaceId +header', SITE, 'syncRecordValues', syncBody(info, info.blockIds, true), sh, checkSync(info)],
    ['G queryCollection @site legacy (CURRENT)', SITE, 'queryCollection', queryBody(info, false), {}, checkQuery()],
    ['H queryCollection @www +spaceId +header', WWW, 'queryCollection', queryBody(info, true), sh, checkQuery()],
    ['I queryCollection @site +spaceId +header', SITE, 'queryCollection', queryBody(info, true), sh, checkQuery()],
    ['J loadPageChunk @site (CURRENT)', SITE, 'loadPageChunk', { pageId: PAGE_ID, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }, {}, checkChunk()],
    ['K loadPageChunk @www +header', WWW, 'loadPageChunk', { pageId: PAGE_ID, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }, sh, checkChunk()],
    ['L loadCachedPageChunkV2 @www +header', WWW, 'loadCachedPageChunkV2', { page: { id: PAGE_ID, spaceId: info.spaceId }, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }, sh, checkChunk()],
  ]
}

/** If a response carries fanoutData, try retrying with every cell-ish value. */
async function tryFanout(host, endpoint, body, headers, r) {
  const candidates = [
    ...findKeys(r.json?.fanoutData, /cell/i),
    ...Object.entries(r.headers || {}).filter(([k]) => /cell/i.test(k)),
  ]
  const tried = []
  for (const [path, value] of candidates) {
    const values = Array.isArray(value) ? value : [value]
    for (const v of values) {
      const cell = typeof v === 'object' ? v?.cellId || v?.id || JSON.stringify(v) : String(v)
      const rr = await call(host, endpoint, body, { ...headers, 'x-notion-cell': cell })
      tried.push(`${path}=${String(cell).slice(0, 40)} -> ${rr.kind}`)
      if (rr.ok) return { ok: true, tried }
    }
  }
  return { ok: false, tried }
}

async function main() {
  console.log(`Site: ${SITE}  page: ${PAGE_ID}  view: ${VIEW_ID}`)
  const info = await discover()
  console.log('Discovered:', JSON.stringify(info))
  const list = methods(info)
  const stats = Object.fromEntries(list.map(([n]) => [n, { ok: 0, fail: {}, ms: [], fanoutRecovered: 0 }]))

  for (let round = 1; round <= ROUNDS; round++) {
    for (const [name, host, ep, body, headers, check] of list) {
      const r = await call(host, ep, body, headers)
      const s = stats[name]
      s.ms.push(r.ms)
      let verdict = r.ok ? check(r) : r.kind
      if (r.kind === 'fanoutData') {
        const f = await tryFanout(host, ep, body, headers, r)
        if (!samples.has(`${name}:fanout`)) {
          samples.set(`${name}:fanout`, { fanoutData: r.json.fanoutData, headers: r.headers, retries: f.tried })
        }
        if (f.ok) { s.fanoutRecovered++; verdict = true }
      }
      if (verdict === true) s.ok++
      else s.fail[verdict] = (s.fail[verdict] || 0) + 1
      const key = `${name}:${r.kind}`
      if (!samples.has(key)) {
        samples.set(key, {
          status: r.status, headers: r.headers, message: r.message,
          body: r.text || JSON.stringify(r.json)?.slice(0, 600),
        })
      }
    }
    console.log(`round ${round}/${ROUNDS} done`)
    if (round < ROUNDS) await wait(GAP_MS)
  }

  console.log('\n===== SUMMARY =====')
  for (const [name, s] of Object.entries(stats)) {
    const avg = Math.round(s.ms.reduce((a, b) => a + b, 0) / s.ms.length)
    const fails = Object.entries(s.fail).map(([k, v]) => `${k} x${v}`).join(', ')
    console.log(`${String(s.ok).padStart(2)}/${ROUNDS}  avg ${String(avg).padStart(5)}ms  ${name}${fails ? `  [${fails}]` : ''}${s.fanoutRecovered ? `  (fanout recovered ${s.fanoutRecovered})` : ''}`)
  }

  if (process.env.NOTION_API_KEY) {
    console.log('\n===== OFFICIAL API =====')
    let ok = 0
    for (let i = 0; i < ROUNDS; i++) {
      const res = await fetch(`https://api.notion.com/v1/blocks/${PAGE_ID}`, {
        headers: { authorization: `Bearer ${process.env.NOTION_API_KEY}`, 'notion-version': '2026-03-11' },
      })
      if (res.ok) ok++
      else console.log(`official: ${res.status} ${(await res.text()).slice(0, 200)}`)
    }
    console.log(`${ok}/${ROUNDS} official API GET block`)
  } else {
    console.log('\nOfficial API: skipped (no NOTION_API_KEY secret)')
  }

  console.log('\n===== SAMPLES =====')
  for (const [k, v] of samples) console.log(`--- ${k}\n${JSON.stringify(v).slice(0, 1500)}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
