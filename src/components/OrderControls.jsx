import { useState, useEffect, useRef } from 'react';

/**
 * Position controls for an admin-ordered list.
 *
 * Shows the item's 1-based position as an editable box plus up/down arrows.
 * Arrows handle the common single-step nudge; typing a number handles the long
 * move (sending item 40 to the top would otherwise be 39 clicks).
 */
export default function OrderControls({ index, total, onMove, disabled = false }) {
  const position = index + 1;
  const [draft, setDraft] = useState(String(position));
  // Enter and Escape blur through this ref rather than the event's
  // currentTarget, which is not reliably still the input by the time the
  // handler runs.
  const inputRef = useRef(null);
  // Escape blurs to close the box, and blur commits — this flag tells commit to
  // discard instead. A state flag would not do: setDraft has not applied yet by
  // the time blur fires, so commit would still read the typed value.
  const cancelRef = useRef(false);

  // Keep the box in step when the list reorders around this item.
  useEffect(() => { setDraft(String(position)); }, [position]);

  const commit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(String(position));
      return;
    }
    const wanted = parseInt(draft, 10);
    if (!Number.isFinite(wanted)) {
      setDraft(String(position));
      return;
    }
    const target = Math.min(total, Math.max(1, wanted)) - 1;
    if (target === index) {
      setDraft(String(position));
      return;
    }
    onMove(index, target);
  };

  const arrow = 'w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white text-text-muted text-xs leading-none cursor-pointer hover:bg-gray-50 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        ref={inputRef}
        type="number"
        min="1"
        max={total}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Blurring runs commit() through onBlur — one commit path, not two.
          if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); }
          if (e.key === 'Escape') { cancelRef.current = true; inputRef.current?.blur(); }
        }}
        aria-label={`Position, currently ${position} of ${total}`}
        title="Type a position and press Enter"
        className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-40"
      />
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove(index, index - 1)}
          disabled={disabled || index === 0}
          aria-label="Move up"
          title="Move up"
          className={arrow}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onMove(index, index + 1)}
          disabled={disabled || index === total - 1}
          aria-label="Move down"
          title="Move down"
          className={arrow}
        >
          ▼
        </button>
      </div>
    </div>
  );
}
