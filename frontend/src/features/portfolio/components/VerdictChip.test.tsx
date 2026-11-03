import { render, screen } from '@testing-library/react-native';

import type { Verdict } from '@/api/schema';

import { verdictMeta, verdictOrder } from '../verdicts';
import { VerdictChip } from './VerdictChip';

describe('VerdictChip', () => {
  const cases: [Verdict, string, string][] = [
    ['Hold', 'HOLD', 'Verdict: Hold'],
    ['HoldReviewSize', 'HOLD \u00b7 SIZE', 'Verdict: Hold, review size'],
    ['Watch', 'WATCH', 'Verdict: Watch'],
    ['Review', 'REVIEW', 'Verdict: Review'],
    ['NoData', 'NO DATA', 'Verdict: No data'],
  ];

  it.each(cases)('%s shows the word and a spoken name', async (verdict, word, spoken) => {
    await render(<VerdictChip verdict={verdict} />);

    expect(screen.getByText(word)).toBeOnTheScreen();
    expect(screen.getByLabelText(spoken)).toBeOnTheScreen();
  });
});

describe('verdict metadata', () => {
  it('orders verdicts as the prototype lists them', () => {
    expect(verdictOrder).toEqual(['HoldReviewSize', 'Hold', 'Watch', 'Review', 'NoData']);
  });

  it('keeps review-size in the hold family but as its own strip segment', () => {
    expect(verdictMeta.HoldReviewSize.chip).toBe('hold');
    expect(verdictMeta.HoldReviewSize.strip).toBe('size');
    expect(verdictMeta.Hold.strip).toBe('hold');
  });
});
