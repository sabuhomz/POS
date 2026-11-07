import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Resolve relative to this file, even when launched outside backend/.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })
