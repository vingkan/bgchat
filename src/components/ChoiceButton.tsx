import type { Choice } from '../story/types';
import type { ChoiceTag } from '../engine/progress';

interface Props {
  choice: Choice;
  index: number; // 0-based; shown as index+1 and bound to number keys
  tag: ChoiceTag; // replayability trail for this exact option (see choiceTag)
  onSelect: () => void;
}

// Display text for each tag state ('none' renders nothing).
const TAG_LABEL: Record<Exclude<ChoiceTag, 'none'>, string> = {
  all: 'Explored all paths',
  completed: 'Completed',
  succeeded: 'Succeeded',
  failed: 'Failed',
  chosen: 'Chosen',
};

// One row in the choice list. Simple and check choices share the layout; a check
// adds the [ Skill · DC ] tag. `tag` surfaces the replayability trail based on what
// the player has actually done with this option (see choiceTag).
export function ChoiceButton({ choice, index, tag, onSelect }: Props) {
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
        {choice.kind === 'check' && (
          <span className="tag">
            [ {choice.skill} · DC {choice.dc} ]
          </span>
        )}
        <span className="label">{choice.label}</span>
        {tag !== 'none' && (
          <span className={tag === 'all' ? 'seen all' : 'seen'}>{TAG_LABEL[tag]}</span>
        )}
      </span>
    </li>
  );
}
