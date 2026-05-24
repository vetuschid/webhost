import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Provider } from '@/lib/types';

export default function ModelPicker({
  provider,
  value,
  onChange,
  onProviderChange,
}: {
  provider: Provider;
  value: string;
  onChange: (m: string) => void;
  onProviderChange: (p: Provider) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['models', provider],
    queryFn: () => api.listModels(provider),
  });
  const models = data?.models || [];
  return (
    <div className="flex gap-2 items-center">
      <select value={provider} onChange={(e) => onProviderChange(e.target.value as Provider)}>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
      </select>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[260px]"
      >
        <option value="">{isLoading ? 'loading…' : models.length ? 'select a model' : 'no models (key missing?)'}</option>
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
