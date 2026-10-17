/**
 * Jest e2e setup. Runs before any spec (and therefore before AppModule is
 * imported) so the API is configured with a deterministic admin key and an
 * isolated media directory. `dotenv`/ConfigModule do not override variables
 * already present in the process environment.
 */
import path from "node:path"

process.env.ADMIN_API_KEY ??= "test-admin-key"
process.env.NODE_ENV = "test"
process.env.MEDIA_DIR ??= path.resolve(__dirname, "..", ".tmp-e2e-media")
