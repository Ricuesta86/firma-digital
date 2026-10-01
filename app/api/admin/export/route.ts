import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/data/auth";
import { getRequestsForExport } from "@/data/requests";
import { buildCsv, buildCsvFilename } from "@/lib/csv";

/**
 * Descarga del CSV de solicitudes.
 *
 * Es un Route Handler y no una Server Action porque el resultado es una descarga
 * binaria, no el retorno de una mutación.
 *
 * La sesión se verifica AQUÍ, dentro del handler: no se delega en el proxy. Si
 * falta, responde 401 en JSON y no redirige, para que un cliente que espera un
 * fichero reciba un error explícito.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 },
    );
  }

  try {
    // `URLSearchParams` no expone sus entradas como propiedades del objeto, así
    // que hay que convertirlas a un objeto plano antes de pasarlas al DAL. Sin
    // esta conversión el DAL no ve ningún filtro y exportaría todo.
    const query: Record<string, string | undefined> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      if (query[key] === undefined) {
        query[key] = value;
      }
    });

    const csv = buildCsv(await getRequestsForExport(query));

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildCsvFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error al generar el CSV de solicitudes:", error);
    return NextResponse.json(
      { error: "Se produjo un error al generar la exportación." },
      { status: 500 },
    );
  }
}
