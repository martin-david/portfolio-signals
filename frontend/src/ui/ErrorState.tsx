import { describeError } from '@/api/errors';

import { Notice } from './Notice';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  testID?: string;
}

/** A failed load: what went wrong in plain words, and a way to try again. */
export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this",
  testID,
}: ErrorStateProps) {
  return (
    <Notice
      tone="danger"
      title={title}
      testID={testID}
      action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
    >
      {describeError(error)}
    </Notice>
  );
}
