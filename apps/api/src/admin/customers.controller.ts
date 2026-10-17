import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { CustomersService } from "./customers.service"
import { listCustomersQuerySchema, type ListCustomersQuery } from "./dto/customers.schemas"

/**
 * Derived customers. There is no stored customer entity: each is keyed by the
 * normalised phone number captured on its orders. Administrative only.
 */
@Controller("admin/customers")
@UseGuards(AdminApiKeyGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQuery) {
    return this.customers.list(query)
  }

  @Get(":phone")
  get(@Param("phone") phone: string) {
    return this.customers.get(phone)
  }
}
