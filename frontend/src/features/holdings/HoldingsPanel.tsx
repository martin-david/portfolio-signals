import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { AnalyzedHoldingDto } from '@/api/schema';
import { VerdictChip } from '@/features/portfolio/components/VerdictChip';
import {
  SORT_LABELS,
  ariaSortOf,
  sortDirectionWords,
  sortHint,
  type PanelSort,
  type SortKey,
} from '@/features/portfolio/panel';
import { noSignalsReason, signalCells } from '@/features/portfolio/signals';
import { tierLabel, verdictMeta } from '@/features/portfolio/verdicts';
import { formatPercent, formatSignedPercent } from '@/lib/format';
import { Amount, Icon, Panel, Text, colors, isHovered, radius, space, webAria } from '@/ui';

import { PANEL_COLUMNS, PANEL_PADDING, SIGNAL_COLUMNS, type PanelMode } from './panelLayout';
import { RowDetail, detailId } from './RowDetail';
import { SignalCellView } from './SignalCells';

/** The six signal columns, in the order of `signalCells`. */
const SIGNAL_HEADINGS = [
  'Smart Score',
  'Consensus',
  'Target upside',
  'AI models',
  'Trend',
  'Analyst breadth',
] as const;

export interface HoldingsPanelProps {
  rows: readonly AnalyzedHoldingDto[];
  /** The largest weight of the whole portfolio, so that the bars keep their scale while the rows are filtered. */
  weightMax: number;
  sort: PanelSort;
  onSort: (key: SortKey) => void;
  expanded: ReadonlySet<string>;
  onToggle: (symbol: string) => void;
  mode: PanelMode;
  /** The result against cost has a column of its own. When it has not, it moves into the details. */
  showPnl: boolean;
  currency: string;
}

function WeightBar({
  row,
  weightMax,
  currency,
}: {
  row: AnalyzedHoldingDto;
  weightMax: number;
  currency: string;
}) {
  const share = Math.max((row.assessment.weightPct / weightMax) * 100, 1);
  return (
    <View style={styles.weight}>
      <View aria-hidden style={styles.track}>
        <View style={[styles.fill, { width: `${share}%` }]} />
      </View>
      <Text variant="caption" tone="muted">
        {`${formatPercent(row.assessment.weightPct)} `}
        <Amount value={row.holding.value} currency={currency} variant="caption" tone="muted" />
      </Text>
    </View>
  );
}

function Score({ row }: { row: AnalyzedHoldingDto }) {
  const { composite, tier } = row.assessment;
  return (
    <View>
      <Text variant="bodyStrong">{composite === null ? '\u2013' : String(composite)}</Text>
      <Text variant="caption" tone="subtle">
        {tierLabel(tier)}
      </Text>
    </View>
  );
}

function Pnl({ row, currency }: { row: AnalyzedHoldingDto; currency: string }) {
  return (
    <View>
      <Text variant="bodyStrong">{formatSignedPercent(row.holding.pnlPct)}</Text>
      <Amount value={row.holding.pnl} currency={currency} signed variant="caption" tone="subtle" />
    </View>
  );
}

/** Says what the button does without relying on its look: expanded, collapsed, and what it controls. */
function toggleProps(symbol: string, expanded: boolean) {
  return {
    'aria-expanded': expanded,
    ...webAria({ 'aria-controls': detailId(symbol) }),
  };
}

function SortArrow({ sort, sortKey }: { sort: PanelSort; sortKey: SortKey }) {
  if (sort.key !== sortKey) {
    return null;
  }
  return (
    <Icon
      name={sort.direction === 'asc' ? 'arrow-up' : 'arrow-down'}
      size={16}
      color={colors.ink}
    />
  );
}

/** A column heading that sorts. The state is in aria-sort on the web and in the label elsewhere. */
function SortHeader({
  sortKey,
  label,
  sort,
  onSort,
  style,
  alignEnd,
}: {
  sortKey: SortKey;
  label: string;
  sort: PanelSort;
  onSort: (key: SortKey) => void;
  style: ViewStyle;
  alignEnd?: boolean;
}) {
  const active = sort.key === sortKey;
  return (
    <View
      role="columnheader"
      testID={`column-${sortKey}`}
      style={style}
      {...webAria({ 'aria-sort': ariaSortOf(sort, sortKey) })}
    >
      <Pressable
        role="button"
        onPress={() => onSort(sortKey)}
        accessibilityLabel={
          Platform.OS === 'web' || !active ? label : `${label}, sorted ${sortDirectionWords(sort)}`
        }
        accessibilityHint={sortHint(sort, sortKey)}
        testID={`sort-${sortKey}`}
        style={(state) => [
          styles.sortButton,
          alignEnd && styles.alignEnd,
          isHovered(state) && styles.hovered,
        ]}
      >
        <Text variant="label" tone={active ? 'ink' : 'muted'}>
          {label}
        </Text>
        <SortArrow sort={sort} sortKey={sortKey} />
      </Pressable>
    </View>
  );
}

function TableRow({
  row,
  weightMax,
  expanded,
  onToggle,
  currency,
}: {
  row: AnalyzedHoldingDto;
  weightMax: number;
  expanded: boolean;
  onToggle: () => void;
  currency: string;
}) {
  const { symbol, name } = row.holding;
  const cells = signalCells(row);
  const covered = cells.some((cell) => cell.present);
  return (
    <View role="row" testID={`holding-row-${symbol}`} style={styles.separated}>
      <View style={styles.line}>
        <View role="rowheader" style={styles.cellHolding}>
          <Pressable
            role="button"
            onPress={onToggle}
            accessibilityLabel={`${symbol}, ${name}`}
            testID={`toggle-${symbol}`}
            style={(state) => [styles.toggle, isHovered(state) && styles.hovered]}
            {...toggleProps(symbol, expanded)}
          >
            <Icon
              name={expanded ? 'chevron-down' : 'chevron-right'}
              size={20}
              color={colors.ink3}
            />
            <Text variant="bodyStrong">{symbol}</Text>
            <Text variant="small" tone="muted" numberOfLines={1} style={styles.name}>
              {name}
            </Text>
          </Pressable>
          <WeightBar row={row} weightMax={weightMax} currency={currency} />
        </View>
        <View role="cell" style={styles.cellVerdict}>
          <VerdictChip verdict={row.assessment.verdict} />
        </View>
        <View role="cell" style={styles.cellScore}>
          <Score row={row} />
        </View>
        {covered ? (
          cells.map((cell) => (
            <View key={cell.key} role="cell" style={styles.cellSignal}>
              <SignalCellView cell={cell} />
            </View>
          ))
        ) : (
          <View role="cell" style={styles.cellNoSignals}>
            <Text variant="caption" tone="subtle">
              {noSignalsReason(row) ?? 'No analyst signals for this holding.'}
            </Text>
          </View>
        )}
        <View role="cell" style={styles.cellPnl}>
          <Pnl row={row} currency={currency} />
        </View>
      </View>
      {expanded ? (
        <RowDetail row={row} inWords={false} showResult={false} currency={currency} />
      ) : null}
    </View>
  );
}

function Table({
  rows,
  weightMax,
  sort,
  onSort,
  expanded,
  onToggle,
  currency,
}: HoldingsPanelProps) {
  return (
    <Panel padding="none" testID="holdings-panel">
      <View role="table" accessibilityLabel="Holdings, one row each" testID="holdings-table">
        <View role="row" style={[styles.line, styles.header]}>
          <SortHeader
            sortKey="weight"
            label="Holding, weight"
            sort={sort}
            onSort={onSort}
            style={styles.cellHolding}
          />
          <SortHeader
            sortKey="verdict"
            label="Verdict"
            sort={sort}
            onSort={onSort}
            style={styles.cellVerdict}
          />
          <SortHeader
            sortKey="score"
            label="Score"
            sort={sort}
            onSort={onSort}
            style={styles.cellScore}
          />
          {SIGNAL_HEADINGS.map((heading) => (
            <View key={heading} role="columnheader" style={styles.cellSignal}>
              <Text variant="label" tone="muted">
                {heading}
              </Text>
            </View>
          ))}
          <SortHeader
            sortKey="pnl"
            label="vs your cost"
            sort={sort}
            onSort={onSort}
            style={styles.cellPnl}
            alignEnd
          />
        </View>
        {rows.map((row) => (
          <TableRow
            key={row.holding.symbol}
            row={row}
            weightMax={weightMax}
            expanded={expanded.has(row.holding.symbol)}
            onToggle={() => onToggle(row.holding.symbol)}
            currency={currency}
          />
        ))}
      </View>
    </Panel>
  );
}

/** The four ways to order the list, for the layouts that have no column headings. */
function SortBar({ sort, onSort }: Pick<HoldingsPanelProps, 'sort' | 'onSort'>) {
  const keys: SortKey[] = ['weight', 'verdict', 'score', 'pnl'];
  return (
    <View role="group" accessibilityLabel="Sort holdings" style={styles.sortBar} testID="sort-bar">
      <Text variant="label" tone="muted">
        Sort by
      </Text>
      {keys.map((key) => {
        const active = sort.key === key;
        return (
          <Pressable
            key={key}
            role="button"
            onPress={() => onSort(key)}
            accessibilityLabel={SORT_LABELS[key]}
            accessibilityHint={sortHint(sort, key)}
            accessibilityState={{ selected: active }}
            testID={`sort-${key}`}
            style={(state) => [
              styles.sortChip,
              active && styles.sortChipActive,
              isHovered(state) && styles.hovered,
            ]}
            {...webAria({ 'aria-pressed': active })}
          >
            <Text variant="label" tone={active ? 'ink' : 'muted'}>
              {SORT_LABELS[key]}
            </Text>
            <SortArrow sort={sort} sortKey={key} />
          </Pressable>
        );
      })}
    </View>
  );
}

function ListRow({
  row,
  weightMax,
  expanded,
  onToggle,
  showPnl,
  currency,
}: {
  row: AnalyzedHoldingDto;
  weightMax: number;
  expanded: boolean;
  onToggle: () => void;
  showPnl: boolean;
  currency: string;
}) {
  const { symbol, name } = row.holding;
  const { verdict, composite, tier, weightPct } = row.assessment;
  return (
    <View role="listitem" testID={`holding-row-${symbol}`} style={styles.separated}>
      <Pressable
        role="button"
        onPress={onToggle}
        accessibilityLabel={[
          `${symbol}, ${name}.`,
          `${verdictMeta[verdict].name}, ${formatPercent(weightPct)} of the account.`,
          composite === null ? undefined : `Score ${composite}, ${tierLabel(tier)}.`,
        ]
          .filter(Boolean)
          .join(' ')}
        testID={`toggle-${symbol}`}
        style={(state) => [styles.listRow, isHovered(state) && styles.hovered]}
        {...toggleProps(symbol, expanded)}
      >
        <View style={styles.listTop}>
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={20} color={colors.ink3} />
          <Text numberOfLines={1} style={styles.listName}>
            <Text variant="bodyStrong">{symbol}</Text>
            <Text variant="small" tone="muted">
              {`\u00a0\u00a0${name}`}
            </Text>
          </Text>
          <VerdictChip verdict={verdict} />
        </View>
        <View style={styles.listMeta}>
          <View style={styles.listWeight}>
            <WeightBar row={row} weightMax={weightMax} currency={currency} />
          </View>
          <Score row={row} />
          {showPnl ? <Pnl row={row} currency={currency} /> : null}
        </View>
      </Pressable>
      {expanded ? <RowDetail row={row} inWords showResult={!showPnl} currency={currency} /> : null}
    </View>
  );
}

function List({
  rows,
  weightMax,
  sort,
  onSort,
  expanded,
  onToggle,
  showPnl,
  currency,
}: HoldingsPanelProps) {
  return (
    <View style={styles.listBox}>
      <SortBar sort={sort} onSort={onSort} />
      <Panel padding="none" testID="holdings-panel">
        <View role="list">
          {rows.map((row) => (
            <ListRow
              key={row.holding.symbol}
              row={row}
              weightMax={weightMax}
              expanded={expanded.has(row.holding.symbol)}
              onToggle={() => onToggle(row.holding.symbol)}
              showPnl={showPnl}
              currency={currency}
            />
          ))}
        </View>
      </Panel>
    </View>
  );
}

/**
 * Every holding, one row each. With room it is the prototype's instrument panel: six range bars per holding, under
 * sortable column headings. Without it, one line per holding, the signals in words inside its details.
 */
export function HoldingsPanel(props: HoldingsPanelProps) {
  return props.mode === 'table' ? <Table {...props} /> : <List {...props} />;
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: space.md,
  },
  header: {
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
    backgroundColor: colors.sheetSunken,
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  cellHolding: { flex: 1, minWidth: PANEL_COLUMNS.holding, paddingRight: space.md, gap: space.xs },
  cellVerdict: { width: PANEL_COLUMNS.verdict },
  cellScore: { width: PANEL_COLUMNS.score },
  cellSignal: { width: PANEL_COLUMNS.signal },
  cellNoSignals: { width: PANEL_COLUMNS.signal * SIGNAL_COLUMNS, paddingRight: space.md },
  cellPnl: { width: PANEL_COLUMNS.pnl, alignItems: 'flex-end' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    borderRadius: radius.sm,
  },
  name: { flexShrink: 1 },
  hovered: { backgroundColor: colors.slateBg },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    minHeight: 40,
    borderRadius: radius.sm,
  },
  alignEnd: { justifyContent: 'flex-end' },
  weight: { gap: 2 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.rule2 },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.ink2 },
  listBox: { gap: space.md },
  sortBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.sheet,
  },
  sortChipActive: { borderColor: colors.ink, backgroundColor: colors.sheet },
  listRow: { padding: space.lg, gap: space.sm },
  listTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  listName: { flex: 1 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingLeft: 28 },
  listWeight: { flex: 1 },
});
