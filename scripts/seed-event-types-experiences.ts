import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

type Pair = { titleEn: string; titleEs: string }

const EXTRA: Pair[] = [
  // Weddings & Life Events
  { titleEn: 'Weddings', titleEs: 'Bodas' },
  { titleEn: 'Engagement Parties', titleEs: 'Fiestas de compromiso' },
  { titleEn: 'Bridal Showers', titleEs: 'Despedidas de soltera' },
  { titleEn: 'Bachelor Parties', titleEs: 'Despedidas de soltero' },
  { titleEn: 'Rehearsal Dinners', titleEs: 'Cenas de ensayo' },
  { titleEn: 'Anniversaries', titleEs: 'Aniversarios' },
  { titleEn: 'Vow Renewals', titleEs: 'Renovación de votos' },
  { titleEn: 'Retirement Parties', titleEs: 'Fiestas de jubilación' },

  // Social Parties (adultos)
  { titleEn: 'Birthday Parties', titleEs: 'Cumpleaños' },
  { titleEn: 'Milestone Birthdays', titleEs: 'Cumpleaños de hito' },
  { titleEn: 'Themed Parties', titleEs: 'Fiestas temáticas' },
  { titleEn: 'Cocktail Parties', titleEs: 'Cócteles' },
  { titleEn: 'Rooftop Parties', titleEs: 'Fiestas en azotea' },
  { titleEn: 'Garden Parties', titleEs: 'Fiestas en jardín' },
  { titleEn: 'Brunch Parties', titleEs: 'Fiestas de brunch' },
  { titleEn: 'High Tea', titleEs: 'Té de la tarde' },
  { titleEn: 'Farewell Parties', titleEs: 'Fiestas de despedida' },
  { titleEn: 'Housewarming', titleEs: 'Inauguración de casa' },
  { titleEn: 'Singles Mixers', titleEs: 'Encuentros de solteros' },

  // Kids & Family
  { titleEn: 'Kids Birthday Parties', titleEs: 'Cumpleaños infantiles' },
  { titleEn: 'Baby Showers', titleEs: 'Baby showers' },
  { titleEn: 'Gender Reveal', titleEs: 'Revelación de sexo' },
  { titleEn: 'Naming Ceremonies', titleEs: 'Ceremonias de nombramiento' },
  { titleEn: 'Family Reunions', titleEs: 'Reencuentros familiares' },

  // Corporate & Professional
  { titleEn: 'Corporate Events', titleEs: 'Eventos corporativos' },
  { titleEn: 'Offsites', titleEs: 'Offsites' },
  { titleEn: 'Team Building', titleEs: 'Team building' },
  { titleEn: 'Board Meetings', titleEs: 'Reuniones de directorio' },
  { titleEn: 'All-Hands', titleEs: 'Reuniones generales' },
  { titleEn: 'Town Halls', titleEs: 'Asambleas abiertas' },
  { titleEn: 'Networking Events', titleEs: 'Eventos de networking' },
  { titleEn: 'Product Launches', titleEs: 'Lanzamientos de producto' },
  { titleEn: 'Press Conferences', titleEs: 'Conferencias de prensa' },
  { titleEn: 'Showcases', titleEs: 'Showcases' },
  { titleEn: 'Brand Activations', titleEs: 'Activaciones de marca' },
  { titleEn: 'Pop-Up Events', titleEs: 'Pop-ups' },
  { titleEn: 'Trade Shows', titleEs: 'Ferias comerciales' },

  // Classes, Workshops & Education
  { titleEn: 'Workshops', titleEs: 'Talleres' },
  { titleEn: 'Seminars', titleEs: 'Seminarios' },
  { titleEn: 'Training Sessions', titleEs: 'Capacitaciones' },
  { titleEn: 'Masterclasses', titleEs: 'Clases magistrales' },
  { titleEn: 'Cooking Classes', titleEs: 'Clases de cocina' },
  { titleEn: 'Baking Classes', titleEs: 'Clases de repostería' },
  { titleEn: 'Mixology Classes', titleEs: 'Clases de coctelería' },
  { titleEn: 'Art Classes', titleEs: 'Clases de arte' },
  { titleEn: 'Photography Classes', titleEs: 'Clases de fotografía' },
  { titleEn: 'Dance Classes', titleEs: 'Clases de baile' },
  { titleEn: 'Language Classes', titleEs: 'Clases de idiomas' },
  { titleEn: 'Book Clubs', titleEs: 'Clubes de lectura' },

  // Creative Production (espacios de creación)
  { titleEn: 'Photo Shoots', titleEs: 'Sesiones fotográficas' },
  { titleEn: 'Film Shoots', titleEs: 'Rodajes' },
  { titleEn: 'Music Video Shoots', titleEs: 'Grabación de videos musicales' },
  { titleEn: 'Casting Sessions', titleEs: 'Castings' },
  { titleEn: 'Table Reads', titleEs: 'Lecturas de guion' },
  { titleEn: 'Screenings', titleEs: 'Proyecciones' },
  { titleEn: 'Theater Rehearsals', titleEs: 'Ensayos de teatro' },
  { titleEn: 'Runway Rehearsals', titleEs: 'Ensayos de pasarela' },
  { titleEn: 'Podcast Recordings', titleEs: 'Grabaciones de podcast' },
  { titleEn: 'Live Streaming', titleEs: 'Transmisiones en vivo' },

  // Arts & Culture
  { titleEn: 'Art Exhibitions', titleEs: 'Exposiciones de arte' },
  { titleEn: 'Gallery Openings', titleEs: 'Inauguraciones de galería' },
  { titleEn: 'Fashion Shows', titleEs: 'Desfiles de moda' },
  { titleEn: 'Cultural Nights', titleEs: 'Noches culturales' },

  // Music & Performance
  { titleEn: 'Concerts', titleEs: 'Conciertos' },
  { titleEn: 'Live Performances', titleEs: 'Presentaciones en vivo' },
  { titleEn: 'Acoustic Sessions', titleEs: 'Sesiones acústicas' },
  { titleEn: 'Open Mic', titleEs: 'Micrófono abierto' },
  { titleEn: 'Comedy Shows', titleEs: 'Shows de comedia' },
  { titleEn: 'Karaoke Parties', titleEs: 'Fiestas de karaoke' },
  { titleEn: 'Dance Parties', titleEs: 'Fiestas de baile' },
  { titleEn: 'Club Nights', titleEs: 'Noches de club' },

  // Food & Beverage Experiences (en espacios)
  { titleEn: 'Private Dining', titleEs: 'Cenas privadas' },
  { titleEn: 'Chef’s Table', titleEs: 'Mesa del chef' },
  { titleEn: 'Tasting Menus', titleEs: 'Menús de degustación' },
  { titleEn: 'Wine Tastings', titleEs: 'Catas de vino' },
  { titleEn: 'Beer Tastings', titleEs: 'Catas de cerveza' },
  { titleEn: 'Whisky Tastings', titleEs: 'Catas de whisky' },
  { titleEn: 'Tea Ceremony', titleEs: 'Ceremonia del té' },
  { titleEn: 'Coffee Cupping', titleEs: 'Cata de café' },
  { titleEn: 'Supper Clubs', titleEs: 'Supper clubs' },
  { titleEn: 'Food Festivals', titleEs: 'Festivales gastronómicos' },

  // Wellness & Fitness
  { titleEn: 'Yoga Sessions', titleEs: 'Sesiones de yoga' },
  { titleEn: 'Meditation Sessions', titleEs: 'Sesiones de meditación' },
  { titleEn: 'Sound Bath', titleEs: 'Baño de sonido' },
  { titleEn: 'Breathwork Circles', titleEs: 'Círculos de respiración' },
  { titleEn: 'Fitness Classes', titleEs: 'Clases de fitness' },
  { titleEn: 'Wellness Retreats', titleEs: 'Retiros de bienestar' },

  // Community & Civic
  { titleEn: 'Community Workshops', titleEs: 'Talleres comunitarios' },
  { titleEn: 'Neighborhood Fairs', titleEs: 'Ferias de barrio' },
  { titleEn: 'Makers Markets', titleEs: 'Mercados de creadores' },
  { titleEn: 'Charity Galas', titleEs: 'Galas benéficas' },
  { titleEn: 'Fundraisers', titleEs: 'Recaudaciones de fondos' },
  { titleEn: 'Auctions', titleEs: 'Subastas' },

  // Religious & Ceremonial (no país-específicas)
  { titleEn: 'Baptisms', titleEs: 'Bautizos' },
  { titleEn: 'First Communions', titleEs: 'Primeras comuniones' },
  { titleEn: 'Confirmations', titleEs: 'Confirmaciones' },
  { titleEn: 'Memorials / Funerals', titleEs: 'Memoriales / Funerales' },

  // Seasonal / Holidays (neutras y globales)
  { titleEn: 'New Year’s Eve', titleEs: 'Año Nuevo' },
  { titleEn: 'Valentine’s Day', titleEs: 'San Valentín' },
  { titleEn: 'Easter / Spring Parties', titleEs: 'Pascua / Fiestas de primavera' },
  { titleEn: 'Halloween', titleEs: 'Halloween' },
  { titleEn: 'Christmas / Holiday Parties', titleEs: 'Navidad / Fiestas de temporada' }
]

const normSlug = (s: string) =>
  s.trim()
   .toLowerCase()
   .normalize('NFKD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9\s-]/g, '')
   .replace(/\s+/g, '-')

async function main() {
  let created = 0, updated = 0
  for (const it of EXTRA) {
    const slug = normSlug(it.titleEn)
    const exists = await prisma.eventType.findUnique({ where: { slug } })
    if (exists) {
      await prisma.eventType.update({
        where: { slug },
        data: { titleEn: it.titleEn, titleEs: it.titleEs || it.titleEn }
      })
      updated++
    } else {
      await prisma.eventType.create({
        data: { slug, titleEn: it.titleEn, titleEs: it.titleEs || it.titleEn }
      })
      created++
    }
  }
  console.log(`Experience event types → created: ${created}, updated: ${updated}`)
}
main().finally(()=>prisma.$disconnect())
