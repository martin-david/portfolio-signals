import { StyleSheet, View } from 'react-native';

import { Button, Panel, StatusLabel, Text, colors, space, type StatusTone } from '@/ui';

import type { ChecklistStep, StepState } from './checklist';

const status: Record<StepState, { tone: StatusTone; label: string; icon?: string }> = {
  done: { tone: 'positive', label: 'Done' },
  todo: { tone: 'neutral', label: 'To do' },
  attention: { tone: 'danger', label: 'Needs attention' },
  working: { tone: 'neutral', label: 'In progress', icon: 'sync' },
  waiting: { tone: 'neutral', label: 'Waiting', icon: 'clock-outline' },
};

export interface GetStartedProps {
  steps: readonly ChecklistStep[];
  onAction: (step: ChecklistStep) => void;
  /** A manual sync is being requested. */
  syncing?: boolean;
}

/** What to do, in order, before there is anything to analyse. Only the next thing to do is a primary button. */
export function GetStarted({ steps, onAction, syncing = false }: GetStartedProps) {
  const next = steps.find((step) => step.state === 'todo' || step.state === 'attention');
  return (
    <Panel padding="none" testID="get-started">
      <View role="list">
        {steps.map((step, index) => {
          const { tone, label, icon } = status[step.state];
          return (
            <View
              key={step.key}
              role="listitem"
              testID={`step-${step.key}`}
              style={[styles.step, index > 0 && styles.separated]}
            >
              <Text variant="figure" tone="subtle" style={styles.number} aria-hidden>
                {String(index + 1)}
              </Text>
              <View style={styles.main}>
                <Text variant="bodyStrong">{step.title}</Text>
                <Text variant="small" tone="muted">
                  {step.detail}
                </Text>
              </View>
              <View style={styles.side}>
                <StatusLabel tone={tone} icon={icon}>
                  {label}
                </StatusLabel>
                {step.action ? (
                  <Button
                    variant={step === next ? 'primary' : 'secondary'}
                    onPress={() => onAction(step)}
                    loading={step.action.to === 'sync' && syncing}
                    testID={`step-action-${step.key}`}
                  >
                    {step.action.label}
                  </Button>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  number: { width: 24 },
  main: { flexGrow: 1, flexShrink: 1, flexBasis: 260, gap: space.xxs },
  side: { flexGrow: 0, flexBasis: 200, gap: space.sm, alignItems: 'flex-start' },
});
