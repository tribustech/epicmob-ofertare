import { Badge } from '@/components/ui/badge';

export function NoPriceBadge({ className }: { className?: string }) {
  return (
    <Badge variant="destructive" className={className}>
      fără preț
    </Badge>
  );
}
