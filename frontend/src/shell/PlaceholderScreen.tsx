import { Band, Heading, Screen, Text } from '@/ui';

import { PageTitle } from './PageTitle';

/** Stands in for a screen that is built in a later step. */
export function PlaceholderScreen({ title, summary }: { title: string; summary: string }) {
  return (
    <Screen>
      <PageTitle title={title} />
      <Band first>
        <Heading level={1}>{title}</Heading>
        <Text tone="muted">{summary}</Text>
      </Band>
    </Screen>
  );
}
