import { exec, execSync } from "node:child_process";
import {writeFileSync} from "fs"

if (process.env.HOME != '/vercel') {
  try {
    execSync('supabase start');
    execSync('supabase migrations up');
    const r = exec('supabase gen types typescript --local --schema public', (err, stdout, stderr) => {
      if (err) {
        console.error(`Error: ${stderr}`);
        throw err;
      } else {
        writeFileSync('types.gen.ts', stdout);
      }
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}
