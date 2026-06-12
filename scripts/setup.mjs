import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

console.log('>> npm install...')
execSync('npm install', { cwd: root, stdio: 'inherit' })

const env = join(root, '.env')
const example = join(root, '.env.example')
if (!existsSync(env) && existsSync(example)) {
  copyFileSync(example, env)
  console.log('>> Created .env from .env.example')
}

console.log('>> Done. Run: npm run dev')
