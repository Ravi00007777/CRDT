import { colorFor, initials } from '../lib/color';

export function Avatar({ id, name, size = 'md', ring }: { id: string; name: string; size?: 'sm' | 'md'; ring?: boolean }) {
  return (
    <span
      title={name}
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ${size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-xs'} ${ring ? 'ring-2 ring-paper' : ''}`}
      style={{ background: colorFor(id) }}
    >
      {initials(name)}
    </span>
  );
}
