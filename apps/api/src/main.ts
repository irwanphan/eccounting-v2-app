import 'reflect-metadata';

import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { bufferLogs: true },
  );

  const logger = new Logger('Bootstrap');

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB untuk import Excel
  });

  const prefix = process.env.API_GLOBAL_PREFIX ?? 'v1';
  app.setGlobalPrefix(prefix);

  const origins = (process.env.API_CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new BusinessExceptionFilter());

  if ((process.env.SWAGGER_ENABLED ?? 'true') !== 'false') {
    const config = new DocumentBuilder()
      .setTitle(process.env.APP_NAME ?? 'Eccounting API')
      .setDescription('Multi-company accounting platform API')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addGlobalParameters({
        name: 'X-Company-Id',
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Tenant context (company ID). Wajib untuk endpoint per-company.',
      })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(process.env.SWAGGER_PATH ?? 'docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  logger.log(`API ready on http://localhost:${port}/${prefix}`);
  logger.log(`Swagger UI: http://localhost:${port}/${process.env.SWAGGER_PATH ?? 'docs'}`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap NestJS application', err);
  process.exit(1);
});
