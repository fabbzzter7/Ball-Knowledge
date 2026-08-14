import {
  EditorialHeader,
  HeroSurface,
  ProgressRail,
  StatPill,
} from "../components/LabPrimitives";
import { mockObjectives } from "../mockData";

export default function LevelUpConcept() {
  return (
    <div className="dl-screen dl-level-up-concept">
      <EditorialHeader
        eyebrow="Level up"
        title="Tactics Reader unlocked."
        copy="Reward presentation should feel rare, confident and memorable."
        align="center"
      />

      <HeroSurface className="dl-level-reward">
        <div className="dl-level-medal">IX</div>
        <span>New level</span>
        <strong>Tactics Reader</strong>
        <p>Sharper reads. Better decisions. Bigger match IQ.</p>
        <div className="dl-result-stats">
          <StatPill label="Reward" value="+250" tone="gold" />
          <StatPill label="XP banked" value="9,000" tone="lime" />
        </div>
      </HeroSurface>

      <section className="dl-objective-panel">
        <strong>Objectives advanced</strong>
        {mockObjectives.map((objective) => (
          <div className="dl-objective-row" key={objective.label}>
            <span>{objective.label}</span>
            <em>
              {objective.value}/{objective.target}
            </em>
          </div>
        ))}
      </section>

      <ProgressRail value={28} label="Next level progress" />
      <button type="button" className="dl-claim-button">Claim and continue</button>
    </div>
  );
}
