import { NextResponse } from "next/server";

import {
  parseRosterWorkbook,
  RosterFileError,
  type RosterRejectionReason,
} from "@/lib/spreadsheet";

/**
 * Importación de la relación de solicitantes desde `.xlsx` o `.csv`.
 *
 * El navegador NO procesa la hoja de cálculo: sube el fichero y recibe filas ya
 * validadas en JSON. El parseo ocurre aquí, con `exceljs`, que no viaja al bundle
 * del cliente (design.md D5).
 *
 * Este handler NO persiste nada. Solo valida y devuelve filas: incorporarlas a la
 * relación es decisión del formulario, que las mantiene en el estado de cliente
 * hasta el envío final.
 */

/** Motivo del rechazo → código HTTP. Los mensajes salen distintos en cada caso. */
const STATUS_BY_REASON: Record<RosterRejectionReason, number> = {
  formato: 415,
  tamaño: 413,
  cabecera: 422,
  limite: 422,
  contenido: 422,
};

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "No se ha recibido un fichero." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se ha recibido ningún fichero que importar." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { filas, errores } = await parseRosterWorkbook(buffer, file.name);

    // Importación parcial: se devuelve cuántas filas son válidas y cuáles no,
    // con el número de fila y el motivo. Se responde 422 porque hay algo que
    // corregir, pero las filas válidas viajan igualmente para que el visitante
    // no pierda el trabajo ya hecho.
    const filasConErrores = new Set(errores.map((error) => error.fila)).size;

    return NextResponse.json(
      {
        filas,
        errores,
        validas: filas.length,
        invalidas: filasConErrores,
        total: filas.length + filasConErrores,
      },
      { status: errores.length > 0 ? 422 : 200 },
    );
  } catch (error) {
    if (error instanceof RosterFileError) {
      return NextResponse.json(
        { error: error.message, detalle: error.detalle },
        { status: STATUS_BY_REASON[error.reason] },
      );
    }

    console.error("Error al importar la relación de solicitantes:", error);
    return NextResponse.json(
      { error: "Se ha producido un error al leer el fichero." },
      { status: 500 },
    );
  }
}
