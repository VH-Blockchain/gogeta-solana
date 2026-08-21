import { useState, type ReactNode } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CheckRounded from '@mui/icons-material/CheckRounded';
import { useConfigStore } from '@/store/configStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { DialogCard, Modal } from '@/components/Modal';
import {
  defaultPredictionFilters,
  orderedShowChips,
  orderedSortChips,
  showIcon,
  sortIcon,
  type PredictionFilters,
} from './filters';

/**
 * Sort + status filters for the Predict list. Port of
 * `showWebPredictionFiltersSheet`/`_WebFiltersDialog`.
 */
export function FiltersDialog({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: PredictionFilters;
  onClose: () => void;
  onApply: (filters: PredictionFilters) => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      {open && (
        <FiltersDialogBody
          key={`${initial.sort}-${initial.show}`}
          initial={initial}
          onClose={onClose}
          onApply={onApply}
        />
      )}
    </Modal>
  );
}

function FiltersDialogBody({
  initial,
  onClose,
  onApply,
}: {
  initial: PredictionFilters;
  onClose: () => void;
  onApply: (filters: PredictionFilters) => void;
}) {
  const cfg = useConfigStore((s) => s.config.predictionList);
  const [sort, setSort] = useState(initial.sort);
  const [show, setShow] = useState(initial.show);

  const sortChips = orderedSortChips(cfg);
  const showChips = orderedShowChips(cfg);

  return (
    <DialogCard maxWidth={440}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: WebTokens.textPrimary }}>
          Sort &amp; filter
        </h2>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn-text" onClick={() => onApply(defaultPredictionFilters(cfg))}>
          Reset
        </button>
        <button
          type="button"
          title="Close"
          aria-label="Close"
          onClick={onClose}
          style={{ color: WebTokens.textMuted, padding: 8, display: 'inline-flex' }}
        >
          <CloseIcon />
        </button>
      </div>

      <div style={{ overflowY: 'auto', minHeight: 0 }}>
        <FilterGroupLabel>Sort by</FilterGroupLabel>
        <ChipWrap>
          {sortChips.map((entry) => {
            const IconComponent = sortIcon[entry.sort];
            return (
              <FilterChip
                key={entry.sort}
                label={entry.label}
                icon={<IconComponent sx={{ fontSize: 15 }} />}
                selected={sort === entry.sort}
                onClick={() => setSort(entry.sort)}
              />
            );
          })}
        </ChipWrap>

        <div style={{ height: 20 }} />

        <FilterGroupLabel>Show</FilterGroupLabel>
        <ChipWrap>
          {showChips.map((entry) => {
            const IconComponent = showIcon[entry.show];
            return (
              <FilterChip
                key={entry.show}
                label={entry.label}
                icon={<IconComponent sx={{ fontSize: 15 }} />}
                selected={show === entry.show}
                onClick={() => setShow(entry.show)}
              />
            );
          })}
        </ChipWrap>
      </div>

      <div style={{ height: 22 }} />

      <GlowButton
        label="Apply filters"
        icon={<CheckRounded />}
        fullWidth
        onClick={() => onApply({ sort, show })}
      />
    </DialogCard>
  );
}

function FilterGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        marginTop: 4,
        marginBottom: 10,
        color: WebTokens.textSecondary,
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      {children}
    </p>
  );
}

function ChipWrap({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>;
}

export function FilterChip({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 14px',
        background: selected ? withAlpha(WebTokens.accent, 0.16) : 'rgba(255,255,255,0.04)',
        borderRadius: 999,
        border: `1px solid ${selected ? withAlpha(WebTokens.accent, 0.55) : WebTokens.border}`,
        color: selected ? WebTokens.accent : WebTokens.textSecondary,
        fontSize: 12.5,
        fontWeight: 700,
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
      }}
    >
      <span style={{ display: 'inline-flex', color: selected ? WebTokens.accent : WebTokens.textMuted }}>
        {icon}
      </span>
      {label}
    </button>
  );
}
