import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildRosterFilename,
  buildRosterWorkbook,
  RosterFileError,
  rosterContentType,
} from "@/lib/spreadsheet";
import { applicantSchema, MAX_APPLICANTS } from "@/lib/validation";

/**
 * Descarga de la relación de solicitantes en `.xlsx`.
 *
 * NO exige sesión, a diferencia de `/api/admin/export`: lo consume el propio
 * visitante del formulario público, que aún no está identificado. Solo se
 * devuelve lo que el visitante acaba de teclear; no se expone ningún dato ya
 * almacenado.
 *
 * `GET` entrega la plantilla (cabecera y cero personas) y `POST` el libro con la
 * relación que envía el modal. Ambos caminos usan el MISMO
 * `buildRosterWorkbook`, que es también el que adjunta el correo de aviso: así el
 * fichero que descarga el visitante y el que recibe el comercial son el mismo,
 * y una corrección de formato no se aplica a un camino y se olvida en el otro
 * (design.md D7).
 */

function workbookResponse(workbook: Buffer): Response {
  return new Response(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type": rosterContentType(),
      "Content-Disposition": `attachment; filename="${buildRosterFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Plantilla vacía: las cinco columnas y ninguna persona. */
export async function GET() {
  try {
    return workbookResponse(await buildRosterWorkbook([]));
  } catch (error) {
    console.error("Error al generar el libro de solicitantes:", error);
    return NextResponse.json(
      { error: "Se ha producido un error al generar el fichero." },
      { status: 500 },
    );
  }
}

const rosterBodySchema = z.object({
  applicants: z.array(applicantSchema).max(MAX_APPLICANTS),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof rosterBodySchema>;

  try {
    payload = rosterBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "La relación enviada no es válida." },
      { status: 422 },
    );
  }

  try {
    return workbookResponse(await buildRosterWorkbook(payload.applicants));
  } catch (error) {
    if (error instanceof RosterFileError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error("Error al generar el libro de solicitantes:", error);
    return NextResponse.json(
      { error: "Se ha producido un error al generar el fichero." },
      { status: 500 },
    );
  }
}
