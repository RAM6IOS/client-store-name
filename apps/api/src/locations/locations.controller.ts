import { Controller, Get, Param, Query } from "@nestjs/common"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { LocationsService } from "./locations.service"
import {
  listCommunesQuerySchema,
  searchCommunesQuerySchema,
  type ListCommunesQuery,
  type SearchCommunesQuery,
} from "./dto/locations.schemas"

@Controller("locations")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get("wilayas")
  listWilayas() {
    const data = this.locations.listWilayas()
    return { data, total: data.length }
  }

  @Get("wilayas/:code")
  getWilaya(@Param("code") code: string) {
    return this.locations.getWilaya(code)
  }

  @Get("wilayas/:code/communes")
  listCommunes(
    @Param("code") code: string,
    @Query(new ZodValidationPipe(listCommunesQuerySchema)) query: ListCommunesQuery,
  ) {
    return this.locations.listCommunes(code, query)
  }

  @Get("communes/search")
  searchCommunes(
    @Query(new ZodValidationPipe(searchCommunesQuerySchema)) query: SearchCommunesQuery,
  ) {
    const data = this.locations.searchCommunes(query)
    return { data, total: data.length }
  }

  @Get("meta")
  meta() {
    return this.locations.getDatasetMeta()
  }

  @Get("verification")
  verification() {
    return this.locations.getVerificationReport()
  }
}
