import dotenv from "dotenv";
import { prisma } from "@paper-trading/db";
import { createServer } from "./server";

dotenv.config();

const port = Number(process.env.PORT ?? 4000);

async function bootstrap() {
  try {
    await prisma.$connect();
    const app = await createServer();
    app.listen(port, () => {
      console.log(`API server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

void bootstrap();

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
