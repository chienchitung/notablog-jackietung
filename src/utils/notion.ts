import { createAgent } from 'notionapi-agent'
import { getOnePageAsTree } from 'nast-util-from-notionapi'

import { log } from './misc'

const dashIDLen = '0eeee000-cccc-bbbb-aaaa-123450000000'.length
const noDashIDLen = '0eeee000ccccbbbbaaaa123450000000'.length
const retryableNotionErrorPattern =
  /(?:\b429\b|\b500\b|\b503\b|\b504\b|\b529\b|rate_limited|service_overload|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|MemcachedCrossCellError|Something went wrong|timeout)/i

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableNotionError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const candidate = error as {
      code?: unknown
      status?: unknown
      message?: unknown
      cause?: unknown
    }
    /** fetch() wraps network failures in TypeError('fetch failed'). */
    if (candidate.cause && isRetryableNotionError(candidate.cause)) {
      return true
    }
    if (
      candidate.status === 429 ||
      candidate.status === 500 ||
      candidate.status === 503 ||
      candidate.status === 504 ||
      candidate.status === 529
    ) {
      return true
    }
    if (
      candidate.code === 'ECONNRESET' ||
      candidate.code === 'ETIMEDOUT' ||
      candidate.code === 'ENOTFOUND' ||
      candidate.code === 'EAI_AGAIN'
    ) {
      return true
    }
  }

  return retryableNotionErrorPattern.test(String(error))
}

/** Run a Notion request, retrying transient failures with backoff. */
export async function withNotionRetry<T>(
  label: string,
  request: () => Promise<T>,
  maxAttempts = 8
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await request()
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts || !isRetryableNotionError(error)) {
        throw error
      }

      const delayMs = Math.min(10000, 1000 * 2 ** (attempt - 1))
      log.info(
        `Retry ${label} after transient error (${attempt}/${maxAttempts}, wait ${delayMs}ms)`
      )
      await wait(delayMs)
    }
  }

  throw lastError
}

export async function getOnePageAsTreeWithRetry(
  pageID: string,
  notionAgent: ReturnType<typeof createAgent>,
  maxAttempts = 8
): Promise<NAST.Block> {
  return withNotionRetry(
    `Notion page fetch "${pageID}"`,
    () => getOnePageAsTree(pageID, notionAgent),
    maxAttempts
  )
}

export function getPageIDFromPageURL(str: string): string {
  let splitArr = str.split('/')
  splitArr = (splitArr.pop() || '').split('-')

  const pageID = splitArr.pop()
  if (pageID && pageID.length === noDashIDLen) {
    return toDashID(pageID)
  } else {
    throw new Error(`Cannot get pageID from ${str}`)
  }
}

export function getPageIDFromCollectionPageURL(str: string): string {
  let splitArr = str.split('/')
  splitArr = (splitArr.pop() || '').split('-')
  splitArr = (splitArr.pop() || '').split('?')

  const pageID = splitArr[0]
  if (pageID && pageID.length === noDashIDLen) {
    return toDashID(pageID)
  } else {
    throw new Error(`Cannot get pageID from ${str}`)
  }
}

export function getBookmarkLinkFromPageURL(str: string): string {
  let splitArr = str.split('/')
  splitArr = (splitArr.pop() || '').split('-')
  splitArr = (splitArr.pop() || '').split('#')

  const blockID = splitArr[1]
  if (blockID && blockID.length === noDashIDLen) {
    return `#${toDashID(blockID)}`
  } else {
    return str
  }
}

export function toDashID(str: string): string {
  if (isValidDashID(str)) {
    return str
  }

  const s = str.replace(/-/g, '')
  if (s.length !== noDashIDLen) {
    return str
  }

  const res =
    str.substring(0, 8) +
    '-' +
    str.substring(8, 12) +
    '-' +
    str.substring(12, 16) +
    '-' +
    str.substring(16, 20) +
    '-' +
    str.substring(20)
  return res
}

export function isValidDashID(str: string): boolean {
  if (str.length !== dashIDLen) {
    return false
  }
  if (str.indexOf('-') === -1) {
    return false
  }
  return true
}
