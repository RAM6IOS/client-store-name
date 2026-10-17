import "reflect-metadata"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { configureApp } from "./app.setup"

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  configureApp(app)
  app.enableShutdownHooks()

  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  app.enableCors({ origin: corsOrigins, credentials: true })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port)

  Logger.log(`API listening on http://localhost:${port}/api`, "Bootstrap")
}

void bootstrap()
