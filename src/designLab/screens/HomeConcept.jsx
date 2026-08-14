import { ProgressRail } from "../components/LabPrimitives";
import { mockPlayer } from "../mockData";

export default function HomeConcept() {
  const xpPercent = Math.round((mockPlayer.xp / mockPlayer.xpTarget) * 100);

  return (
    <div className="dl-screen dl-home-v4">
      {/* TOP BAR */}
      <header className="dl-v4-topbar">
        <div className="dl-v4-user">
          <div className="dl-v4-avatar">{mockPlayer.avatar}</div>

          <div className="dl-v4-user-copy">
            <span>WELCOME BACK</span>
            <strong>{mockPlayer.name}</strong>
          </div>
        </div>

        <div className="dl-v4-top-stats">
          <div className="dl-v4-coin">
            <span>◆</span>
            <strong>{mockPlayer.coins}</strong>
          </div>

          <div className="dl-v4-streak">
            <span>🔥</span>
            <strong>{mockPlayer.streak}</strong>
          </div>
        </div>
      </header>

      <main className="dl-v4-content">
        {/* HERO */}
        <section className="dl-v4-hero">
          <div className="dl-v4-hero-grid" />
          <div className="dl-v4-hero-glow" />

          <div className="dl-v4-hero-copy">
            <div className="dl-v4-live">
              <span />
              BALL KNOWLEDGE
            </div>

            <h1>
              How good is your
              <em> football IQ?</em>
            </h1>

            <p>
              Put your knowledge to the test.
              <br />
              Play. Compete. Climb.
            </p>
          </div>

          <div className="dl-v4-play-zone">
            <button type="button" className="dl-v4-mode dl-v4-mode-primary">
              <div className="dl-v4-mode-icon">⚽</div>

              <div>
                <small>PLAY NOW</small>
                <strong>Single Player</strong>
                <span>7 game modes</span>
              </div>

              <b>›</b>
            </button>

            <button type="button" className="dl-v4-mode dl-v4-mode-multi">
              <div className="dl-v4-mode-icon">VS</div>

              <div>
                <small>COMPETE</small>
                <strong>Multiplayer</strong>
                <span>Challenge rivals</span>
              </div>

              <b>›</b>
            </button>
          </div>
        </section>

        {/* DAILY */}
        <button type="button" className="dl-v4-daily">
          <div className="dl-v4-daily-tag">TODAY</div>

          <div className="dl-v4-daily-main">
            <div className="dl-v4-daily-icon">◎</div>

            <div>
              <small>DAILY CHALLENGE</small>
              <strong>Today&apos;s test is live</strong>
              <span>Keep your {mockPlayer.streak} day streak alive</span>
            </div>
          </div>

          <div className="dl-v4-daily-arrow">›</div>
        </button>

        {/* PROGRESSION */}
        <section className="dl-v4-progress">
          <div className="dl-v4-progress-head">
            <div>
              <small>YOUR SEASON</small>
              <strong>{mockPlayer.levelName}</strong>
            </div>

            <div className="dl-v4-level">
              <span>LVL</span>
              <b>{mockPlayer.level}</b>
            </div>
          </div>

          <div className="dl-v4-progress-line">
            <ProgressRail value={xpPercent} label="XP progress" />
          </div>

          <div className="dl-v4-progress-meta">
            <span>
              <b>{mockPlayer.xp.toLocaleString()}</b>
              {" / "}
              {mockPlayer.xpTarget.toLocaleString()} XP
            </span>

            <span>
              Next: <b>{mockPlayer.nextLevel}</b>
            </span>
          </div>
        </section>

        {/* NAVIGATION */}
        <section className="dl-v4-section">
          <div className="dl-v4-section-heading">
            <span>CLUBHOUSE</span>
            <small>More</small>
          </div>

          <div className="dl-v4-nav">
            <button type="button" className="dl-v4-nav-item dl-v4-nav-league">
              <div className="dl-v4-nav-icon">▲</div>
              <strong>Leagues</strong>
              <span>Climb together</span>
            </button>

            <button type="button" className="dl-v4-nav-item dl-v4-nav-rank">
              <div className="dl-v4-nav-icon">#</div>
              <strong>Rankings</strong>
              <span>See the best</span>
            </button>

            <button type="button" className="dl-v4-nav-item dl-v4-nav-profile">
              <div className="dl-v4-nav-icon">{mockPlayer.avatar}</div>
              <strong>Profile</strong>
              <span>Your career</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}