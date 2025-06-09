import { execSync } from "node:child_process";
import {writeFileSync} from "fs"

if (process.env.HOME != '/vercel') {
  try {
    execSync('supabase start');
    execSync('supabase migrations up');
    const stdout = execSync('supabase gen types typescript --local --schema public', { encoding: 'utf8' });
    writeFileSync('types.gen.ts', stdout);
  } catch (err) {
    console.error(err);
    throw err;
  }
}
