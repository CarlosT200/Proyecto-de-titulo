import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirComprobante, abrirDocumento, urlComprobante, urlDocumento } from "./documentos";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apertura de archivos protegidos", () => {
  it("las URL apuntan a la API del mismo origen y no llevan ningún token", () => {
    expect(urlDocumento("doc-1")).toBe("/api/documentos/doc-1/archivo");
    expect(urlComprobante("cmp-1")).toBe("/api/gastos-comunes/comprobantes/cmp-1/archivo");
    expect(urlDocumento("a/../b?x=1")).toBe("/api/documentos/a%2F..%2Fb%3Fx%3D1/archivo");
  });

  it("abre el archivo en una pestaña nueva", async () => {
    const abrir = vi.spyOn(window, "open").mockReturnValue({} as Window);
    await abrirDocumento("doc-1");
    await abrirComprobante("cmp-1");
    expect(abrir).toHaveBeenNthCalledWith(1, "/api/documentos/doc-1/archivo", "_blank");
    expect(abrir).toHaveBeenNthCalledWith(2, "/api/gastos-comunes/comprobantes/cmp-1/archivo", "_blank");
  });
});
