import type { FlagSeverity } from '@/api/schema';
import { StatusLabel } from '@/ui/StatusLabel';

import { severityMeta } from '../verdicts';

/** How serious a flag is, as a glyph and a word. */
export function SeverityLabel({ severity }: { severity: FlagSeverity }) {
  const meta = severityMeta[severity];
  return (
    <StatusLabel tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </StatusLabel>
  );
}
