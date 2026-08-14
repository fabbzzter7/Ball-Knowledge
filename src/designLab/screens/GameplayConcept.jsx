export default function GameplayConcept() {
  const answers = [
    { id: "a", label: "Johan Cruyff", tone: "emerald" },
    { id: "b", label: "Diego Maradona", tone: "gold" },
    { id: "c", label: "Zinedine Zidane", tone: "violet" },
    { id: "d", label: "Pelé", tone: "cyan" },
  ];

  return (
    <div className="dl-screen dl-gameplay-concept-v2">
      <div className="dl-gameplay-shell">
        <div className="dl-gameplay-topbar">
          <button type="button" className="dl-gameplay-exit">
            <span>←</span>
            <span>Exit</span>
          </button>

          <div className="dl-gameplay-mode-meta">
            <span className="dl-gameplay-mode-label">Live Quiz</span>
            <strong>General Knowledge</strong>
          </div>

          <div className="dl-gameplay-question-meta">
            <span>Question</span>
            <strong>01 / 20</strong>
          </div>
        </div>

        <div className="dl-gameplay-progress-wrap">
          <div className="dl-gameplay-progress-head">
            <span>Club Football</span>
            <span>Early run</span>
          </div>
          <div className="dl-gameplay-progress-rail">
            <div
              className="dl-gameplay-progress-fill"
              style={{ width: "12%" }}
            />
          </div>
        </div>

        <div className="dl-gameplay-stats">
          <div className="dl-gameplay-stat-card dl-gameplay-stat-card--primary">
            <span>Score</span>
            <strong>0</strong>
          </div>

          <div className="dl-gameplay-stat-card">
            <span>Best</span>
            <strong>7</strong>
          </div>

          <div className="dl-gameplay-stat-card">
            <span>Lives</span>
            <strong>3</strong>
          </div>

          <div className="dl-gameplay-stat-card">
            <span>Streak</span>
            <strong>x0</strong>
          </div>
        </div>

        <section className="dl-gameplay-question-card">
          <div className="dl-gameplay-question-kicker">
            <span className="dl-gameplay-question-dot" />
            <span>Player History</span>
          </div>

          <h2>
            Which player is strongly associated with the
            <span> number 14 </span>
            shirt?
          </h2>

          <p>
            Choose the correct football icon before the timer pressure builds.
          </p>

          <div className="dl-gameplay-question-mark" aria-hidden="true">
            14
          </div>
        </section>

        <div className="dl-gameplay-answers-grid">
          {answers.map((answer) => (
            <button
              key={answer.id}
              type="button"
              className={`dl-gameplay-answer-card dl-gameplay-answer-card--${answer.tone}`}
            >
              <div className="dl-gameplay-answer-accent" />
              <div className="dl-gameplay-answer-content">
                <span className="dl-gameplay-answer-badge">{answer.id}</span>
                <strong>{answer.label}</strong>
              </div>
            </button>
          ))}
        </div>

        <div className="dl-gameplay-footer-stats">
          <div>
            <span>Best run</span>
            <strong>7 correct</strong>
          </div>
          <div>
            <span>Current</span>
            <strong>0 correct</strong>
          </div>
        </div>
      </div>
    </div>
  );
}