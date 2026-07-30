import type { Choice } from '../story/types';

interface Props {
  choice: Choice;
  index: number; // 0-based; shown as index+1 and bound to number keys
  seen: boolean; // has the player already visited where this choice leads?
  onSelect: () => void;
}

// One row in the choice list. Simple and check choices share the layout; a check
// adds the [ Skill · DC ] tag. `seen` surfaces the replayability trail.
export function ChoiceButton({ choice, index, seen, onSelect }: Props) {
  return (
    <li
      className="choice"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="num">{index + 1}</span>
      <span className="body">
        <span className="label">{choice.label}</span>
        {choice.kind === 'check' && (
          <span className="tag">
            [ {choice.skill} · DC {choice.dc} ]
          </span>
        )}
        {seen && <span className="seen">seen</span>}
      </span>
    </li>
  );
}
