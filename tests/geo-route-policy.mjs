import assert from "node:assert/strict";
import fs from "node:fs";

for (const name of ["ti-admin-bridge", "platform-bridge", "datasul-bridge"]) {
  const source = fs.readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
  assert.match(source, /withSupabase\(\{ auth: "user" \}/);
  assert.match(source, /headers\.has\("cf-ipcountry"\)\s*&&\s*!isBrazilRequest/);
  assert.match(source, /status:\s*403|FORBIDDEN/);
}

for (const name of ["ti-code-login", "manager-activation"]) {
  const source = fs.readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
  assert.match(source, /if \(!isBrazilRequest\(request\)\)/);
}
console.log("Authenticated Edge geo-fallback contracts passed.");
