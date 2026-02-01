#!/usr/bin/env node

import { Command } from 'commander'
import { Logger } from '@dnpr/logger'
import { generate, preview } from '../dist/index.esm.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))

const program = new Command()

program
  .name('notablog')
  .description('Generate a minimalistic blog from a Notion.so table')
  .version(pkg.version)

program
  .command('generate')
  .description('Generate the blog')
  .argument('<path_to_notablog-starter>', 'Path to the notablog-starter directory')
  .option('-v, --verbose', 'Print more messages for debugging', false)
  .option('--fresh', 'Generate without cache', false)
  .action(async (workDir, options) => {
    const logger = new Logger('notablog-cli', {
      logLevel: options.verbose ? 'debug' : 'info',
      useColor: !process.env.NO_COLOR,
    })

    try {
      const startTime = Date.now()
      await generate(workDir, {
        workDir,
        verbose: options.verbose,
        ignoreCache: options.fresh,
        concurrency: 3
      })
      const endTime = Date.now()
      const timeElapsed = (endTime - startTime) / 1000
      logger.info(`Done in ${timeElapsed}s. Run 'notablog preview ${workDir}' to preview`)
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('preview')
  .description('Open a local server to preview the blog')
  .argument('<path_to_notablog-starter>', 'Path to the notablog-starter directory')
  .option('-v, --verbose', 'Print more messages for debugging', false)
  .action(async (workDir, options) => {
    const logger = new Logger('notablog-cli', {
      logLevel: options.verbose ? 'debug' : 'info',
      useColor: !process.env.NO_COLOR,
    })

    try {
      await preview(workDir)
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program.parse()
