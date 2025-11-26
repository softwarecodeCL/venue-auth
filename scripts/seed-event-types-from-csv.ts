// scripts/seed-event-types-from-csv.ts
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const prisma = new PrismaClient()

type Row = {
  // Posibles nombres de columnas
  slug?: string
  titleEn?: string
  titleEs?: string
  title_en?: string
  title_es?: string
  event_type_en?: string
  event_type_es?: string
}

const normSlug = (s: string) =>
  s.trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')    // quita acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')

async function main() {
  // Pon tu CSV aquí (o ajusta la ruta)
  const csvPath = 'C:\\Users\\matrix\\Documents\\proyectoMX\\auth-backend\\auth-service\\scripts\\data\\eventTypes_master.csv'
  if (!fs.existsSync(csvPath)) {
    throw new Error(`No se encontró el CSV en: ${csvPath}\nMueve el archivo ahí o ajusta la ruta en el script.`)
  }

  const csv = fs.readFileSync(csvPath, 'utf8')
  const rows = parse(csv, { columns: true, skip_empty_lines: true }) as Row[]

  let created = 0
  let updated = 0
  const seen = new Set<string>()

  for (const r of rows) {
    // 1) Resolver títulos EN/ES desde cualquiera de las variantes
    const titleEn =
      (r.event_type_en ?? r.titleEn ?? r.title_en ?? '').trim()
    const titleEsRaw =
      (r.event_type_es ?? r.titleEs ?? r.title_es ?? '').trim()
    if (!titleEn) continue

    // 2) Resolver slug: usar el provisto o generarlo desde titleEn
    const slug = (r.slug && r.slug.trim()) ? normSlug(r.slug) : normSlug(titleEn)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)

    const data = { slug, titleEn, titleEs: titleEsRaw || titleEn }

    // 3) Upsert + conteo exacto
    const existing = await prisma.eventType.findUnique({ where: { slug } })
    if (existing) {
      // Solo actualizar si cambió algo
      if (existing.titleEn !== data.titleEn || existing.titleEs !== data.titleEs) {
        await prisma.eventType.update({
          where: { slug },
          data: { titleEn: data.titleEn, titleEs: data.titleEs },
        })
        updated++
      }
    } else {
      await prisma.eventType.create({ data })
      created++
    }
  }

  console.log(`Event types procesados: ${seen.size}. Creados: ${created}, Actualizados: ${updated}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
