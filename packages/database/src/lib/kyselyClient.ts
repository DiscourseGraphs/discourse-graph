import { DB } from '../kyselyTypes';
import { Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'

let client: Kysely<DB>|null|false = null;

export const getClient = (): Kysely<DB>|false => {
  if (client === null) {
    if (!process.env.SUPABASE_URL) {
      client = false;
    } else {
      try {
        const url = new URL(process.env.SUPABASE_URL);
        const dialect = new PostgresDialect({
          pool: new Pool({
            database: url.pathname,
            host: url.host,
            user: url.username,
            password: url.password,
            port: parseInt(url.port),
            max: 10,
          })
        })
        client =  new Kysely<DB>({
          dialect,
        });
      } catch {
        client = false;
      }
    }
  }
  return client;
}
