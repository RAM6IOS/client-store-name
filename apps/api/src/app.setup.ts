import type { INestApplication } from "@nestjs/common"
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter"
import { BigIntSerializerInterceptor } from "./common/interceptors/bigint-serializer.interceptor"

/**
 * Applies the HTTP surface shared by `main.ts` and the e2e test harness so
 * tests exercise the same prefix, filters and serialisation as production.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api")
  app.useGlobalFilters(new DomainExceptionFilter())
  app.useGlobalInterceptors(new BigIntSerializerInterceptor())
}
