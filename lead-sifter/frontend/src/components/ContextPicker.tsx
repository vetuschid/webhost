import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ContextPicker({
  value,
  onChange,
  allowNone = false,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
}) {
  const { data: bundles = [] } = useQuery({ queryKey: ['bundles'], queryFn: api.listBundles });
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">{allowNone ? '— no context —' : 'select a context bundle'}</option>
      {bundles.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
