import { describe, expect, it } from "vitest";
import { evaluarEntornoSeed } from "./guardiaSeed";

const evaluar = (databaseUrl: string | undefined, permiso?: string) => evaluarEntornoSeed({ databaseUrl, permiso });

describe("guardia del seed de demostración", () => {
  it("corre sin preguntar contra bases locales o cuyo nombre termina en _test/_demo", () => {
    expect(evaluar("postgresql://u:p@localhost:5432/habitasmart").permitido).toBe(true);
    expect(evaluar("postgresql://u:p@127.0.0.1:5432/x").permitido).toBe(true);
    expect(evaluar("postgresql://u:p@db.ejemplo.com:5432/habitasmart_test").permitido).toBe(true);
    expect(evaluar("postgresql://u:p@db.ejemplo.com:5432/habitasmart_demo?schema=public").permitido).toBe(true);
  });

  it("se NIEGA contra una base remota (por ejemplo la de producción) sin permiso explícito", () => {
    const r = evaluar("postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres");
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/PERMITIR_SEED_DEMO=si/);
    // cualquier otro valor no cuenta como permiso
    expect(evaluar("postgresql://u:p@remoto.com/postgres", "true").permitido).toBe(false);
  });

  it("con PERMITIR_SEED_DEMO=si se permite sobre una base remota", () => {
    expect(evaluar("postgresql://u:p@remoto.com/postgres", "si").permitido).toBe(true);
  });

  it("sin DATABASE_URL o con una URL inválida no corre", () => {
    expect(evaluar(undefined).permitido).toBe(false);
    expect(evaluar("no-es-url").permitido).toBe(false);
  });
});
