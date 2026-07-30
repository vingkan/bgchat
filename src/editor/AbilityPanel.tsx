import { MODIFIER_TABLE, SKILL_GROUPS, scoresForMod, type Action } from './model';

interface Props {
  skillMods: Record<string, number>;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

// Floating panel to set one modifier per SKILL, grouped under its ability. Each
// check's modifier is derived from the skill it uses, so this table is the single
// place that controls "how good is the hero at X". The score range next to each
// modifier is a reference (5e: +0 = ability score 10–11).
export function AbilityPanel({ skillMods, dispatch, onClose }: Props) {
  return (
    <div className="ed-abilities">
      <div className="ed-abilities-head">
        <span>Skill modifiers</span>
        <button className="ed-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="ed-abilities-body">
        {SKILL_GROUPS.map((group) => (
          <div key={group.ability} className="ed-ability-group">
            <div className="ed-ability-group-name">{group.ability}</div>
            {group.skills.map((skill) => {
              const mod = skillMods[skill] ?? 0;
              return (
                <div key={skill} className="ed-skill-row">
                  <span className="ed-skill-name">{skill}</span>
                  <span className={`ed-mod-chip${mod >= 0 ? ' pos' : ' neg'}`}>
                    {mod >= 0 ? `+${mod}` : mod}
                  </span>
                  <select
                    value={mod}
                    onChange={(e) => dispatch({ type: 'setSkillMod', skill, mod: Number(e.target.value) })}
                  >
                    {MODIFIER_TABLE.map((m) => (
                      <option key={m.mod} value={m.mod}>
                        {m.mod >= 0 ? `+${m.mod}` : m.mod} · score {m.scores}
                      </option>
                    ))}
                  </select>
                  <span className="ed-mod-scores">score {scoresForMod(mod)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
