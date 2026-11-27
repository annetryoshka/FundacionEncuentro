import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ExportarGenogramaService } from "../exportar-genograma.service.js";
import { renderizarGenograma } from "../renderizar-genograma.js";
import type { DatabaseService } from "../../../database/database.service.js";

vi.mock("../renderizar-genograma.js", () => ({
  renderizarGenograma: vi.fn().mockResolvedValue([]),
}));

describe("FE-156 · versión y huella del genograma", () => {
  const contenido = Buffer.from("imagen ficticia");
  const g = {
    vigente: true,
    clave: "caso/version-original",
    tipo: "image/png",
    sha256: createHash("sha256").update(contenido).digest("hex"),
  };
  const montar = (
    filas: unknown[] = [
      { contenido, tipo: "image/png", nombre: "original.png" },
    ],
  ) => {
    const query = vi.fn().mockResolvedValue({ rows: filas });
    const transaction = vi.fn((_u, fn) => fn({ query }));
    return {
      query,
      transaction,
      servicio: new ExportarGenogramaService({
        transaction,
      } as unknown as DatabaseService),
    };
  };

  it("sin selección no lee archivos", async () => {
    const { servicio, transaction } = montar();
    expect(await servicio.preparar("caso", "autora", {})).toBeUndefined();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("usa la clave de la fotografía revisada y vuelve a limitar la consulta al caso y usuario", async () => {
    const { servicio, query, transaction } = montar();
    await servicio.preparar("caso", "autora", {
      documento: "informe",
      fotografia: { genograma: g },
    });
    expect(transaction).toHaveBeenCalledWith("autora", expect.any(Function));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("casos_investigacion_autorizados"),
      ["caso/version-original", "caso", "autora"],
    );
    expect(renderizarGenograma).toHaveBeenCalledWith(contenido, "image/png");
  });

  it("no entrega otro archivo si falta la versión autorizada", async () => {
    const { servicio } = montar([]);
    await expect(
      servicio.preparar("caso", "autora", { genograma: g }),
    ).rejects.toThrow("verificar");
  });

  it("rechaza una huella o un tipo que no corresponde a la fotografía", async () => {
    const { servicio } = montar();
    await expect(
      servicio.preparar("caso", "autora", {
        genograma: { ...g, sha256: "0".repeat(64) },
      }),
    ).rejects.toThrow("verificar");
    await expect(
      servicio.preparar("caso", "autora", {
        genograma: { ...g, tipo: "application/pdf" },
      }),
    ).rejects.toThrow("verificar");
  });
});
