import React from 'react';
import { PROVIDER_PRESETS } from '../../shared/providers';

interface Props {
  value: string;
  onChange: (key: string) => void;
}

export default function ProviderSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-fox-orange focus:ring-1 focus:ring-fox-orange"
    >
      <option value="">请选择提供商</option>
      {PROVIDER_PRESETS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
