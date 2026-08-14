import { EditorialHeader, ProgressRail, StatPill } from "../components/LabPrimitives";

export default function ResultConcept() {
  return (
    <div className="dl-screen dl-result-concept">
      <EditorialHeader
        eyebrow="Full time"
        title="Statement win."
        copy="A result screen should feel satisfying without becoming noisy."
        align="center"
      />

      <section className="dl-result-board">
        <div className="dl-score-number">18</div>
        <span>Correct answers</span>
        <ProgressRail value={90} label="Performance" />
      </section>

      <div className="dl-result-stats">
        <StatPill label="XP earned" value="+820" tone="lime" />
        <StatPill label="Coins" value="+140" tone="gold" />
        <StatPill label="Best streak" value="11" tone="teal" />
      </div>

      <section className="dl-performance-summary">
        <strong>Performance summary</strong>
        <p>Elite tempo, clean decision-making, and one missed classic-era question.</p>
      </section>

      <div className="dl-action-row">
        <button type="button">Continue</button>
        <button type="button">Replay run</button>
      </div>
    </div>
  );
}
