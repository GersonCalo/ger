import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080
const NODE_ENV = process.env.NODE_ENV || 'development'
const DATABASE_URL = process.env.DATABASE_URL || ''

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: NODE_ENV })
})

app.get('/config', (_req, res) => {
  res.json({ hasDatabaseUrl: Boolean(DATABASE_URL) })
})

// TODO: rutas de auth, transactions, groups según el plan

app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`)
})
