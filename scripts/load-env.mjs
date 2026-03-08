import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

export function getEnvFileForNodeEnv(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === 'production' ? '.env.production' : '.env'
}

export function loadEnv(nodeEnv = process.env.NODE_ENV) {
  const envFile = getEnvFileForNodeEnv(nodeEnv)
  const envPath = path.resolve(process.cwd(), envFile)

  if (!fs.existsSync(envPath)) {
    throw new Error(`${envFile} was not found at ${envPath}`)
  }

  config({
    path: envPath,
    override: true
  })

  return {
    envFile,
    envPath
  }
}

export const loadedEnv = loadEnv()
