type CityOption = { id: string; name: string; state_uf: string };

type Props = {
  cities: CityOption[];
  /** Label do campo. */
  label?: string;
  /** Cidade pré-selecionada (usado na edição). */
  defaultValue?: string;
  compact?: boolean;
};

/**
 * Seletor de cidade mostrado apenas para o usuário master. Gestores não veem
 * este campo — a cidade deles é aplicada no servidor, sem depender do formulário.
 */
export function CitySelect({ cities, label = 'Cidade', defaultValue = '', compact = false }: Props) {
  const labelClass = compact ? 'mb-1 block text-xs font-semibold text-slate-500' : 'mb-1 block text-sm font-semibold text-slate-700';
  const fieldClass = compact
    ? 'w-full rounded-lg border border-slate-300 bg-white px-2 py-2 outline-none focus:border-blue-600'
    : 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600';

  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select name="city_id" required defaultValue={defaultValue} className={fieldClass}>
        <option value="" disabled>Selecione a cidade</option>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>{city.name} / {city.state_uf}</option>
        ))}
      </select>
    </label>
  );
}
