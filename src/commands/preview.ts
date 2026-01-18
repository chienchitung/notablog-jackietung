import { createServer } from 'vite'

import { outDir } from '../utils/misc'

/**
 * Preview the generated blog using a local dev server.
 */
export async function preview(workDir: string): Promise<void> {
  const root = outDir(workDir)
  
  const server = await createServer({
    // any valid user config options, plus `mode` and `configFile`
    root,
    server: {
      port: 3000,
      open: true
    }
  })
  
  await server.listen()
  
  server.printUrls()
  console.log(`\nServing blog from: ${root}`)
}
