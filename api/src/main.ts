import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ENV } from './shared/infrastructure/config/config.module';
import { loadDotEnv, type Env } from './shared/infrastructure/config/env';
import { configureApp } from './shared/presentation/configure-app';

async function bootstrap() {
  loadDotEnv();
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);
  configureApp(app, { webOrigin: env.WEB_ORIGIN });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}
void bootstrap();
