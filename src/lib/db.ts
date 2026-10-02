import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log warnings and errors — not every query.
    // The previous `log: ['query']` setting logged EVERY query, creating
    // massive I/O overhead and multi-MB log files. For query analysis,
    // use Prisma Studio or the $queryRaw inspection tools.
    log: ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
