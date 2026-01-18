import fs from 'fs'
import path from 'path'
import https from 'https'
import visit from 'unist-util-visit'
import { log } from './misc'
import { toDashID } from './notion'

export async function downloadAssets(
  tree: NAST.Block,
  outDir: string
) {
  const assetDir = path.join(outDir, 'assets/notion')
  if (!fs.existsSync(assetDir)) {
    fs.mkdirSync(assetDir, { recursive: true })
  }

  const downloads: Promise<void>[] = []

  // @ts-ignore
  visit(tree, (node: any) => {
    // 1. Handle direct Image blocks
    if (node.type === 'image' && node.source) {
      const source = node.source as string
      if (source.startsWith('attachment:')) {
        processAttachment(source, node.uri, (newPath) => {
          node.source = newPath
        })
      }
    }

    // 2. Handle Properties (e.g. in Table Rows / Pages)
    // node.properties is a map of propertyId -> SemanticString[]
    if (node.properties) {
      Object.values(node.properties).forEach((propValue: any) => {
        if (Array.isArray(propValue)) {
          // @ts-ignore
          const callbackBlockUri = node.uri || ''
          scanSemanticString(propValue, callbackBlockUri)
        }
      })
    }
  })

  function scanSemanticString(semanticString: any[], blockUri: string) {
     semanticString.forEach(segment => {
       // segment format: [text, formattings?]
       // formattings: [ ['a', url], ['b'], ... ]
       if (segment.length > 1 && Array.isArray(segment[1])) {
         segment[1].forEach((formatting: any) => {
           if (formatting[0] === 'a' && formatting[1]) {
             const url = formatting[1] as string
             if (url.startsWith('attachment:')) {
               processAttachment(url, blockUri, (newPath) => {
                 formatting[1] = newPath
               })
             }
           }
         })
       }
     })
  }

  function processAttachment(source: string, blockUri: string, updateCb: (newPath: string) => void) {
        // Extract ID from URI (e.g. https://www.notion.so/2eb3... -> 2eb3...)
        const rawId = (blockUri || '').split('/').pop() || ''
        const blockId = toDashID(rawId)
        
        const urlObj = transformAttachmentUrl(source, blockId)
        if (urlObj && blockId) {
          const { url, filename } = urlObj
          const localFilename = `${blockId}-${filename}`
          const localPath = path.join(assetDir, localFilename)
          const publicPath = `assets/notion/${localFilename}`

          downloads.push(downloadFile(url, localPath).then(() => {
            updateCb(publicPath)
          }).catch(err => {
            log.error(`Failed to download image ${url}: ${err}`)
          }))
        }
  }

  await Promise.all(downloads)
}

function transformAttachmentUrl(attachmentUrl: string, blockId: string) {
  // Format: attachment:<uuid>:<filename>?width=...
  // Example: attachment:5e0c...:image.png?width=829.99
  
  // Remove "attachment:" prefix
  const raw = attachmentUrl.substring(11) // "5e0c...:image.png?width=..."
  
  // Split by first colon to get UUID
  const firstColon = raw.indexOf(':')
  if (firstColon === -1) return null
  
  const uuid = raw.substring(0, firstColon)
  const rest = raw.substring(firstColon + 1)
  
  // Split remainder by ? to get filename and query
  const queryIndex = rest.indexOf('?')
  let filename = rest
  if (queryIndex !== -1) {
    filename = rest.substring(0, queryIndex)
  }
  
  // Construct S3 URL
  // https://s3.us-west-2.amazonaws.com/secure.notion-static.com/<uuid>/<filename>
  const s3Url = `https://s3.us-west-2.amazonaws.com/secure.notion-static.com/${uuid}/${filename}`
  
  // Construct Proxy URL
  // https://www.notion.so/image/<encoded_s3>?table=block&id=<block_id>
  const proxyUrl = `https://www.notion.so/image/${encodeURIComponent(s3Url)}?table=block&id=${blockId}`
  
  return {
    url: proxyUrl,
    filename: filename
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if file exists and has content
    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest)
      if (stats.size > 0) {
        resolve()
        return
      }
      // Delete empty file to retry download
      fs.unlinkSync(dest)
    }

    const file = fs.createWriteStream(dest)
    
    const cleanup = () => {
      file.close()
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
      }
    }

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
         if (response.headers.location) {
             file.close()
             fs.unlinkSync(dest)
             downloadFile(response.headers.location, dest).then(resolve).catch(reject)
             return
         }
      }

      if (response.statusCode !== 200) {
        cleanup()
        reject(new Error(`Failed to download ${url}, status code: ${response.statusCode}`))
        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', (err) => {
        cleanup()
        reject(err)
      })
    }).on('error', (err) => {
      cleanup()
      reject(err)
    })
  })
}
