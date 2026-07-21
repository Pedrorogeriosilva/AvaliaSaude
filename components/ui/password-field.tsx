'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

type Props = {
  id?: string;
  name?: string;
  label?: string;
  required?: boolean;
  autoComplete?: string;
};

export function PasswordField({
  id = 'password',
  name = 'password',
  label = 'Senha',
  required = true,
  autoComplete = 'current-password',
}: Props) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="block">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={isVisible ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-11 outline-none focus:border-blue-600"
        />

        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {isVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
