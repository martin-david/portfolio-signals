import type { CopySegment } from '@/features/portfolio/narrative';
import { Amount, Text, type TextProps } from '@/ui';

export interface CopyTextProps extends Omit<TextProps, 'children'> {
  segments: readonly CopySegment[];
  currency?: string;
}

/** Generated copy that may contain the user's own amounts, which are hidden when the user asks. */
export function CopyText({ segments, currency = 'USD', tone = 'muted', ...text }: CopyTextProps) {
  return (
    <Text tone={tone} {...text}>
      {segments.map((segment, index) =>
        typeof segment === 'string' ? (
          segment
        ) : (
          <Amount
            key={index}
            value={segment.amount}
            signed={segment.signed}
            currency={currency}
            variant={text.variant}
            tone={tone}
          />
        ),
      )}
    </Text>
  );
}
