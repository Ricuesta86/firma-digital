import Link from "next/link";

import { StatusBadge } from "@/components/admin/status-badge";
import type { RequestListDto } from "@/data/requests";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatDateTime(value: Date): string {
  return dateFormatter.format(value);
}

export function RequestsTable({ list }: { list: RequestListDto }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">
                Recibida
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Solicitante
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Empresa
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Certificado
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Estado
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                Ficha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-5 py-4 text-zinc-500">
                  {formatDateTime(item.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-zinc-900">{item.fullName}</p>
                  <p className="text-xs text-zinc-500">{item.email}</p>
                  <p className="text-xs text-zinc-500">NIF {item.nif}</p>
                </td>
                <td className="px-5 py-4 text-zinc-700">
                  {item.companyName}
                </td>
                <td className="px-5 py-4 text-zinc-700">
                  {item.certificateType}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/admin/requests/${item.id}`}
                    className="font-medium text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
