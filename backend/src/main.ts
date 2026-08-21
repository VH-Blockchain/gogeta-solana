import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './storage/storage.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  // Serve uploaded media at /api/uploads/... (kept under /api so the existing
  // reverse-proxy route to the backend applies).
  app.useStaticAssets(join(process.cwd(), UPLOAD_DIR.replace(/^\.\//, '')), { prefix: '/api/uploads' });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Predora API')
    .setDescription('Prediction & Rewards Platform — serves the mobile app and the admin panel.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Predora API → http://localhost:${port}/api   (Swagger: /docs)`);
}
void bootstrap();
