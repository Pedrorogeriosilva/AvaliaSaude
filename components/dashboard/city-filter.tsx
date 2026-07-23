'use client';

import { MapPin } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

type CityOption = { id: string; name: string; state_uf: string };

type Props = {
  cities: CityOption[];
  selectedCityId: string;
};

/**
 * Filtro de cidade do painel/ranking, exibido apenas para o master. Ao trocar a
 * cidade, atualiza o parâmetro `?cidade=` da própria página — sem cidade,
 * significa "todas as cidades". O painel e o ranking não usam outros parâmetros
 * de busca, então a URL é reconstruída só com a cidade.
 */
export function CityFilter({ cities, selectedCityId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? '/painel';
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const target = value ? `${pathname}?cidade=${encodeURIComponent(value)}` : pathname;
    startTransition(() => {
      router.push(target);
    });
  }

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <MapPin size={16} className="shrink-0 text-blue-700" aria-hidden="true" />
      <span className="sr-only">Filtrar por cidade</span>
      <select
        value={selectedCityId}
        onChange={(event) => handleChange(event.target.value)}
        disabled={isPending}
        className="min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none disabled:opacity-60"
      >
        <option value="">Todas as cidades</option>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>{city.name} / {city.state_uf}</option>
        ))}
      </select>
    </label>
  );
}
