import { resolveDatabaseConfig } from "@/lib/db-config";

type Expected = { driver: string; url: string; authToken: string | null } | string;

const cases: Array<[string, Record<string, string>, Expected]> = [
  ["DATABASE_URL tiene prioridad", { DATABASE_URL: "libsql://x", TURSO_DATABASE_URL: "libsql://x", TURSO_AUTH_TOKEN: "t" }, { driver: "turso", url: "libsql://x", authToken: "t" }],
  ["solo TURSO_DATABASE_URL", { TURSO_DATABASE_URL: "libsql://x", TURSO_AUTH_TOKEN: "t" }, { driver: "turso", url: "libsql://x", authToken: "t" }],
  ["sin variables -> fichero local", {}, { driver: "local-file", url: "file:./data/app.db", authToken: null }],
  ["token huerfano se ignora", { TURSO_AUTH_TOKEN: "t" }, { driver: "local-file", url: "file:./data/app.db", authToken: null }],
  ["DATABASE_URL local", { DATABASE_URL: "file:/a.db" }, { driver: "local-file", url: "file:/a.db", authToken: null }],
  ["libsql sin token -> error", { TURSO_DATABASE_URL: "libsql://x" }, "CONFIGURACION_BD_SIN_TOKEN"],
  ["string en blanco = ausente", { DATABASE_URL: "   " }, { driver: "local-file", url: "file:./data/app.db", authToken: null }],
  ["file+libsql -> error (normal)", { DATABASE_URL: "file:/a.db", TURSO_DATABASE_URL: "libsql://x", TURSO_AUTH_TOKEN: "t" }, "CONFIGURACION_BD_AMBIGUA"],
  ["file+libsql -> error (invertido)", { DATABASE_URL: "libsql://x", TURSO_DATABASE_URL: "file:/a.db", TURSO_AUTH_TOKEN: "t" }, "CONFIGURACION_BD_AMBIGUA"],
  ["token en blanco = ausente", { TURSO_DATABASE_URL: "libsql://x", TURSO_AUTH_TOKEN: "  " }, "CONFIGURACION_BD_SIN_TOKEN"],
  ["espacios normalizados", { TURSO_DATABASE_URL: "  libsql://x  ", TURSO_AUTH_TOKEN: " t " }, { driver: "turso", url: "libsql://x", authToken: "t" }],
];

let failed = 0;
for (const [name, env, expected] of cases) {
  try {
    const got = resolveDatabaseConfig(env);
    const ok = typeof expected !== "string" && JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} | ${name} -> ${JSON.stringify(got)}`);
  } catch (e) {
    const msg = (e as Error).message;
    const ok = typeof expected === "string" && msg.includes(expected);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} | ${name} -> throws: ${msg.slice(0, 50)}`);
  }
}
console.log(failed === 0 ? "\nAll scenarios passed" : `\n${failed} FAILED`);
