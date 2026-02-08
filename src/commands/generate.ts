import fs from 'fs'
import path from 'path'
import { createAgent } from 'notionapi-agent'
import { TaskManager2 } from '@dnpr/task-manager'
import { copyDirSync } from '@dnpr/fsutil'

import { Cache } from '../cache'
import { Config } from '../config'
import { parseTable } from '../parseTable'
import { EJSStrategy, Renderer } from '../renderer'
import { renderIndex } from '../renderIndex'
import { renderPost } from '../renderPost'
import { log, parseJSON } from '../utils/misc'
import { toDashID } from '../utils/notion'
import { RenderPostTask, SiteContext, ThemeConfig } from '../types'

type GenerateOptions = {
  /** Concurrency for Notion page downloading and rendering. */
  concurrency?: number
  /** Whether to print more messages for debugging. */
  verbose?: boolean
  /** Do not check cache and fetch all pages from Notion. */
  ignoreCache?: boolean
}

/** Generate a Notablog static site. */
export async function generate(
  workDir: string,
  opts: GenerateOptions = {}
): Promise<number> {
  const { concurrency, verbose, ignoreCache } = opts

  const notionAgent = createAgent({
    debug: verbose,
    token: process.env.NOTION_TOKEN || process.env.token_v2,
  })
  const cache = new Cache(path.join(workDir, 'cache'))
  const config = new Config(path.join(workDir, 'config.json'))

  /** Init dir paths. */
  const theme = config.get('theme')
  const themeDir = path.join(workDir, `themes/${theme}`)
  if (!fs.existsSync(themeDir)) {
    throw new Error(`Cannot find theme "${theme}" in themes/`)
  }

  const outDir = path.join(workDir, 'public')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const tagDir = path.join(workDir, 'public/tag')
  if (!fs.existsSync(tagDir)) {
    fs.mkdirSync(tagDir, { recursive: true })
  }

  const dirs = {
    workDir,
    themeDir,
    outDir,
    tagDir,
  }

  /** Create TemplateProvider instance. */
  const templateDir = path.join(themeDir, 'layouts')
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Cannot find layouts/ in theme "${theme}"`)
  }
  const themeManifestPath = path.join(themeDir, 'manifest.json')
  const themeManifest = parseJSON(
    fs.readFileSync(themeManifestPath, { encoding: 'utf-8' })
  ) as ThemeConfig
  if (!themeManifest)
    throw new Error(`The theme is not supported by Notablog v0.6.0 or above.`)
  // const templateEngine = themeManifest.templateEngine
  const renderStrategy = new EJSStrategy(templateDir)
  const renderer = new Renderer(renderStrategy)

  /** Copy theme assets. */
  log.info('Copy theme assets')
  const assetDir = path.join(themeDir, 'assets')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  copyDirSync(assetDir, outDir)

  /** Fetch site metadata. */
  log.info('Fetch site metadata')
  const siteContext = await parseTable(config.get('url'), notionAgent, config)

  /** Render home page and tags */
  log.info('Render home page and tags')
  renderIndex({
    data: {
      siteContext: siteContext,
    },
    tools: {
      renderer,
      notionAgent,
      cache,
    },
    config: {
      ...dirs,
    },
  })

  /** Render pages. */
  log.info('Fetch and render pages')
  const { pagesUpdated, pagesNotUpdated } = siteContext.pages.reduce(
    (data, page) => {
      if (
        ignoreCache ||
        cache.shouldUpdate('notion', toDashID(page.id), page.lastEditedTime)
      ) {
        data.pagesUpdated.push(page)
      } else {
        data.pagesNotUpdated.push(page)
      }
      return data
    },
    {
      pagesUpdated: [],
      pagesNotUpdated: [],
    } as {
      pagesUpdated: typeof siteContext.pages
      pagesNotUpdated: typeof siteContext.pages
    }
  )

  const pageTotalCount = siteContext.pages.length
  const pageUpdatedCount = pagesUpdated.length
  const pagePublishedCount = siteContext.pages.filter(
    page => page.publish
  ).length
  log.info(`${pageUpdatedCount} of ${pageTotalCount} posts have been updated`)
  log.info(`${pagePublishedCount} of ${pageTotalCount} posts are published`)

  const tm2 = new TaskManager2({ concurrency })
  const tasks = []
  pagesUpdated.forEach(pageMetadata => {
    tasks.push(
      tm2.queue(
        () =>
          renderPost({
            data: {
              siteContext,
              pageMetadata,
              doFetchPage: true,
            },
            tools: {
              renderer,
              notionAgent,
              cache,
            },
            config: {
              ...dirs,
            },
          } as RenderPostTask),
        []
      ) as never
    )
  })
  pagesNotUpdated.forEach(pageMetadata => {
    tasks.push(
      tm2.queue(
        () =>
          renderPost({
            data: {
              siteContext,
              pageMetadata,
              doFetchPage: false,
            },
            tools: {
              renderer,
              notionAgent,
              cache,
            },
            config: {
              ...dirs,
            },
          } as RenderPostTask),
        []
      ) as never
    )
  })
  await Promise.all(tasks)

  /** Prune orphaned files. */
  pruneOrphanedFiles(siteContext, dirs)

  /** Update sitemap.xml. */
  writeSitemapXml({
    outDir,
    siteUrl: config.get('siteUrl') || 'https://www.chienchitung.com',
  })

  return 0
}

/**
 * Delete HTML files in outDir and tagDir that are no longer in siteContext.
 */
function pruneOrphanedFiles(
  siteContext: SiteContext,
  dirs: { outDir: string; tagDir: string }
): void {
  log.info('Prune orphaned files')

  const validFiles = new Set<string>()
  validFiles.add('index.html')

  // Collect valid page URLs
  siteContext.pages.forEach(page => {
    if (page.publish && !/^https?:\/\//.test(page.url)) {
      validFiles.add(page.url)
    }
  })

  // Collect valid tag URLs
  siteContext.tagMap.forEach((_pages, tagVal) => {
    validFiles.add(`tag/${tagVal}.html`)
  })

  /** Helper to scan and delete. */
  const scanAndDelete = (dir: string, relativePrefix = '') => {
    if (!fs.existsSync(dir)) return
    const files = fs.readdirSync(dir)
    files.forEach(file => {
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)
      if (stats.isFile() && file.endsWith('.html')) {
        const relativePath = path.join(relativePrefix, file)
        if (!validFiles.has(relativePath)) {
          log.info(`Delete orphaned file: ${relativePath}`)
          fs.unlinkSync(filePath)
        }
      }
    })
  }

  scanAndDelete(dirs.outDir)
  scanAndDelete(dirs.tagDir, 'tag')
}

type SitemapOptions = {
  outDir: string
  siteUrl: string
}

function writeSitemapXml(options: SitemapOptions): void {
  const { outDir, siteUrl } = options
  log.info('Generate sitemap.xml')

  const urls = new Set<string>()
  const normalizedBase = siteUrl.replace(/\/$/, '')

  const collectHtmlFiles = (dir: string) => {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    entries.forEach(entry => {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        collectHtmlFiles(entryPath)
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        const relativePath = path
          .relative(outDir, entryPath)
          .split(path.sep)
          .join('/')

        if (relativePath === 'index.html') {
          urls.add(`${normalizedBase}/`)
        } else {
          urls.add(`${normalizedBase}/${relativePath}`)
        }
      }
    })
  }

  collectHtmlFiles(outDir)

  const urlEntries = Array.from(urls)
    .sort()
    .map(url => `  <url>\n    <loc>${url}</loc>\n  </url>`)
    .join('\n')

  const sitemapXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlEntries}\n` +
    `</urlset>\n`

  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml, 'utf-8')
}
