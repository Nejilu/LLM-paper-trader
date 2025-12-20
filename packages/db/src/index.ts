import { PrismaClient } from "@prisma/client";

type GlobalWithPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

const createPrismaClient = () =>
  new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

const prismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
export * from "@prisma/client";
