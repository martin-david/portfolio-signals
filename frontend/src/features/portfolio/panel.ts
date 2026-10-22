import type { AnalyzedHoldingDto } from '@/api/schema';

import { verdictMeta } from './verdicts';

export type PanelFilter = 'all' | 'material' | 'attention';
export type SortKey = 'weight' | 'verdict' | 'score' | 'pnl';
export type SortDirection = 'asc' | 'desc';

export interface PanelSort {
  key: SortKey;
  direction: SortDirection;
}

/** The panel opens with the largest positions first, as the report does. */
export const DEFAULT_SORT: PanelSort = { key: 'weight', direction: 'desc' };

/** The first click on a column sorts the way that column is read: biggest first, verdicts in their natural order. */
export const FIRST_DIRECTION: Record<SortKey, SortDirection> = {
  weight: 'desc',
  verdict: 'asc',
  score: 'desc',
  pnl: 'desc',
};

export function filterHoldings(
  rows: readonly AnalyzedHoldingDto[],
  filter: PanelFilter,
): AnalyzedHoldingDto[] {
  switch (filter) {
    case 'material':
      return rows.filter((row) => row.assessment.material);
    case 'attention':
      return rows.filter(
        (row) => row.assessment.verdict === 'Watch' || row.assessment.verdict === 'Review',
      );
    default:
      return [...rows];
  }
}

export function filterCounts(rows: readonly AnalyzedHoldingDto[]): Record<PanelFilter, number> {
  return {
    all: rows.length,
    material: filterHoldings(rows, 'material').length,
    attention: filterHoldings(rows, 'attention').length,
  };
}

function sortValue(row: AnalyzedHoldingDto, key: SortKey): number | null {
  switch (key) {
    case 'weight':
      return row.assessment.weightPct;
    case 'verdict':
      return verdictMeta[row.assessment.verdict].order;
    case 'score':
      return row.assessment.composite;
    case 'pnl':
      return row.holding.pnlPct;
  }
}

/** Sorts a copy of the rows. Rows without a value for the column (no score, for example) always come last. */
export function sortHoldings(
  rows: readonly AnalyzedHoldingDto[],
  sort: PanelSort,
): AnalyzedHoldingDto[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === null && y === null) {
      return b.assessment.weightPct - a.assessment.weightPct;
    }
    if (x === null) {
      return 1;
    }
    if (y === null) {
      return -1;
    }
    return x === y ? b.assessment.weightPct - a.assessment.weightPct : (x - y) * factor;
  });
}

/** What a click on a column header does: the same column flips direction, another column starts as it is read. */
export function nextSort(current: PanelSort, key: SortKey): PanelSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: FIRST_DIRECTION[key] };
}

export function ariaSortOf(current: PanelSort, key: SortKey): 'ascending' | 'descending' | 'none' {
  if (current.key !== key) {
    return 'none';
  }
  return current.direction === 'asc' ? 'ascending' : 'descending';
}

/** What each column is called, in the header and in sentences about the order. */
export const SORT_LABELS: Record<SortKey, string> = {
  weight: 'Weight',
  verdict: 'Verdict',
  score: 'Score',
  pnl: 'Result vs your cost',
};

const DIRECTION_WORDS: Record<SortKey, Record<SortDirection, string>> = {
  weight: { desc: 'largest first', asc: 'smallest first' },
  verdict: { asc: 'holds first', desc: 'no data first' },
  score: { desc: 'highest first', asc: 'lowest first' },
  pnl: { desc: 'best first', asc: 'worst first' },
};

/** The direction in words: "largest first", "worst first". */
export function sortDirectionWords(sort: PanelSort): string {
  return DIRECTION_WORDS[sort.key][sort.direction];
}

/** The order in words, for the caption under the filters and for the label of a column button. */
export function describeSort(sort: PanelSort): string {
  return `${SORT_LABELS[sort.key]}, ${sortDirectionWords(sort)}`;
}

/** What pressing a column button will do, for assistive technology. */
export function sortHint(current: PanelSort, key: SortKey): string {
  return `Sort by ${describeSort(nextSort(current, key)).toLowerCase()}`;
}
