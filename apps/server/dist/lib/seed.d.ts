import type { PrismaClient } from '@prisma/client';
/**
 * Idempotent database seed — safe to run on every server startup.
 * Uses upsert so existing data is never overwritten.
 */
export declare function seedDatabase(prisma: PrismaClient): Promise<void>;
//# sourceMappingURL=seed.d.ts.map