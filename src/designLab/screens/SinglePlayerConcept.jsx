const MODES = [
  {
    id: "career",
    eyebrow: "PLAYER IQ",
    title: "Career Path",
    description: "Trace the clubs and spot the career.",
    statLabel: "HIGHSCORE",
    stat: "28",
    statSuffix: "IN A ROW",
    tone: "blue",
  },
  {
    id: "worldcup",
    eyebrow: "GLOBAL",
    title: "World Cup",
    description: "History's greatest tournament.",
    statLabel: "HIGHSCORE",
    stat: "45",
    statSuffix: "IN A ROW",
    tone: "gold",
  },
  {
    id: "whoami",
    eyebrow: "CLUES",
    title: "Who Am I?",
    description: "Guess the player before the reveal.",
    statLabel: "BEST STREAK",
    stat: "16",
    statSuffix: "",
    tone: "violet",
  },
  {
    id: "connections",
    eyebrow: "PATTERN PLAY",
    title: "Connections",
    description: "Group the players. Solve the puzzle.",
    statLabel: "BEST STREAK",
    stat: "19",
    statSuffix: "",
    tone: "cyan",
  },
  {
    id: "find",
    eyebrow: "SCOUTING",
    title: "Find the Player",
    description: "Use the hints. Find the player.",
    statLabel: "BEST STREAK",
    stat: "14",
    statSuffix: "",
    tone: "orange",
  },
  {
    id: "top10",
    eyebrow: "RANKINGS",
    title: "Top 10",
    description: "Name the greatest. Beat the list.",
    statLabel: "HIGHSCORE",
    stat: "37",
    statSuffix: "IN A ROW",
    tone: "coral",
  },
];

function FootballArtwork() {
  return (
    <svg viewBox="0 0 220 180" aria-hidden="true">
      <circle cx="112" cy="87" r="51" className="sp-svg-soft" />
      <circle cx="112" cy="87" r="42" className="sp-svg-line" />
      <polygon
        points="112,61 130,73 124,95 100,95 94,73"
        className="sp-svg-fill"
      />
      <path
        d="M112 61 L112 44 M130 73 L148 64 M124 95 L138 112 M100 95 L85 112 M94 73 L76 64"
        className="sp-svg-line"
      />
      <path
        d="M38 137 C78 118 153 119 194 144"
        className="sp-svg-line sp-svg-faint"
      />
      <path
        d="M25 149 C82 124 152 129 207 158"
        className="sp-svg-line sp-svg-faint"
      />
    </svg>
  );
}

function CareerArtwork() {
  return (
    <svg viewBox="0 0 220 150" aria-hidden="true">
      <path
        d="M24 126 C55 111 47 76 85 72 C123 67 104 36 158 39 C184 40 187 22 199 18"
        className="sp-svg-line sp-svg-route"
      />
      <circle cx="25" cy="126" r="6" className="sp-svg-fill" />
      <circle cx="84" cy="72" r="6" className="sp-svg-fill" />
      <circle cx="158" cy="39" r="6" className="sp-svg-fill" />
      <path d="M198 18 V47" className="sp-svg-line" />
      <path d="M198 19 L216 25 L198 32 Z" className="sp-svg-fill" />
    </svg>
  );
}

function WorldCupArtwork() {
  return (
    <svg viewBox="0 0 200 170" aria-hidden="true">
      <ellipse cx="118" cy="143" rx="54" ry="10" className="sp-svg-soft" />
      <path
        d="M96 32
           C95 52 98 63 107 75
           C112 82 113 96 109 108
           L92 130
           L142 130
           L126 108
           C122 96 123 82 129 74
           C139 60 141 46 139 32
           C128 39 108 39 96 32 Z"
        className="sp-svg-fill"
      />
      <circle cx="117" cy="53" r="22" className="sp-svg-line" />
      <path d="M90 130 H145" className="sp-svg-line" />
      <path
        d="M48 31 L57 21 L66 31 L75 21 L84 31"
        className="sp-svg-line sp-svg-faint"
      />
    </svg>
  );
}

function WhoAmIArtwork() {
  return (
    <svg viewBox="0 0 200 170" aria-hidden="true">
      <circle cx="118" cy="59" r="30" className="sp-svg-soft" />
      <circle cx="118" cy="59" r="24" className="sp-svg-fill-dark" />
      <path
        d="M69 145 C74 105 93 91 118 91 C143 91 163 105 168 145"
        className="sp-svg-fill-dark"
      />
      <text x="108" y="73" className="sp-svg-question">
        ?
      </text>
      <circle cx="118" cy="77" r="56" className="sp-svg-line sp-svg-faint" />
    </svg>
  );
}

function ConnectionsArtwork() {
  return (
    <svg viewBox="0 0 210 160" aria-hidden="true">
      <g transform="translate(73 39) rotate(-7)">
        <rect x="0" y="0" width="50" height="50" rx="9" className="sp-svg-fill" />
        <circle cx="50" cy="25" r="9" className="sp-svg-cut" />
        <circle cx="25" cy="0" r="9" className="sp-svg-cut" />
      </g>

      <g transform="translate(121 51) rotate(7)">
        <rect x="0" y="0" width="50" height="50" rx="9" className="sp-svg-fill-soft" />
        <circle cx="0" cy="25" r="9" className="sp-svg-cut" />
        <circle cx="25" cy="50" r="9" className="sp-svg-cut" />
      </g>

      <g transform="translate(77 88) rotate(5)">
        <rect x="0" y="0" width="50" height="50" rx="9" className="sp-svg-fill-soft" />
        <circle cx="25" cy="0" r="9" className="sp-svg-cut" />
      </g>
    </svg>
  );
}

function FindArtwork() {
  return (
    <svg viewBox="0 0 210 170" aria-hidden="true">
      <circle cx="122" cy="88" r="58" className="sp-svg-line" />
      <circle cx="122" cy="88" r="40" className="sp-svg-line sp-svg-faint" />
      <circle cx="122" cy="88" r="21" className="sp-svg-line sp-svg-faint" />
      <circle cx="122" cy="88" r="6" className="sp-svg-fill" />
      <path d="M122 23 V153 M57 88 H187" className="sp-svg-line sp-svg-faint" />
      <path d="M122 88 L165 50" className="sp-svg-line sp-svg-route" />
      <circle cx="165" cy="50" r="5" className="sp-svg-fill" />
    </svg>
  );
}

function Top10Artwork() {
  return (
    <svg viewBox="0 0 220 165" aria-hidden="true">
      <rect x="77" y="74" width="53" height="68" rx="6" className="sp-svg-fill" />
      <rect x="130" y="98" width="46" height="44" rx="6" className="sp-svg-fill-soft" />
      <rect x="31" y="110" width="46" height="32" rx="6" className="sp-svg-fill-soft" />

      <text x="97" y="112" className="sp-svg-podium">
        1
      </text>
      <text x="49" y="132" className="sp-svg-podium-small">
        2
      </text>
      <text x="145" y="128" className="sp-svg-podium-small">
        3
      </text>
    </svg>
  );
}

function ModeArtwork({ id }) {
  switch (id) {
    case "career":
      return <CareerArtwork />;
    case "worldcup":
      return <WorldCupArtwork />;
    case "whoami":
      return <WhoAmIArtwork />;
    case "connections":
      return <ConnectionsArtwork />;
    case "find":
      return <FindArtwork />;
    case "top10":
      return <Top10Artwork />;
    default:
      return null;
  }
}

function GameCard({ mode }) {
  return (
    <button
      type="button"
      className={`sp-game-card sp-game-card--${mode.tone}`}
    >
      <div className="sp-game-card__art">
        <ModeArtwork id={mode.id} />
      </div>

      <span className="sp-game-card__arrow" aria-hidden="true">
        ›
      </span>

      <div className="sp-game-card__content">
        <span className="sp-game-card__eyebrow">{mode.eyebrow}</span>

        <strong>{mode.title}</strong>

        <p>{mode.description}</p>

        <div className="sp-game-card__record">
          <small>{mode.statLabel}</small>
          <b>{mode.stat}</b>
          {mode.statSuffix && <span>{mode.statSuffix}</span>}
        </div>
      </div>
    </button>
  );
}

export default function SinglePlayerConcept() {
  return (
    <div className="dl-screen sp-hub">
      {/* HEADER */}
      <header className="sp-header">
        <div className="sp-header-copy">
          <span>SINGLE PLAYER</span>

          <h1>
            Choose your
            <br />
            challenge.
          </h1>

          <p>
            Different tests. Same game.
            <br />
            How good is your football knowledge?
          </p>
        </div>

        <div className="sp-header-art">
          <FootballArtwork />
        </div>
      </header>

      {/* FEATURED */}
      <section className="sp-section">
        <div className="sp-section-heading">
          <span>FEATURED</span>
          <small>Most played</small>
        </div>

        <button type="button" className="sp-featured">
          <div className="sp-featured-art">
            <WorldCupArtwork />
          </div>

          <div className="sp-featured-content">
            <span>FEATURED</span>

            <h2>
              General
              <br />
              Knowledge
            </h2>

            <p>
              Fast questions across clubs,
              <br />
              players and eras.
            </p>

            <div className="sp-featured-bottom">
              <div className="sp-featured-record">
                <small>HIGHSCORE</small>
                <strong>32</strong>
                <span>IN A ROW</span>
              </div>

              <span className="sp-featured-play">
                PLAY NOW
                <b>›</b>
              </span>
            </div>
          </div>
        </button>
      </section>

      {/* MODES */}
      <section className="sp-section sp-discover">
        <div className="sp-section-heading">
          <span>DISCOVER ALL MODES</span>
          <small>{MODES.length} modes</small>
        </div>

        <div className="sp-games-grid">
          {MODES.map((mode) => (
            <GameCard key={mode.id} mode={mode} />
          ))}
        </div>
      </section>

      {/* PROGRESS */}
      <section className="sp-progress">
        <span className="sp-progress-title">YOUR PROGRESS</span>

        <div className="sp-progress-main">
          <div className="sp-level-badge">
            <span>18</span>
          </div>

          <div className="sp-level-copy">
            <strong>LEVEL 18</strong>
            <span>Football Scholar</span>
          </div>

          <b>82%</b>
        </div>

        <div className="sp-progress-track">
          <span />
        </div>

        <div className="sp-progress-stats">
          <div>
            <strong>1,284</strong>
            <span>QUESTIONS ANSWERED</span>
          </div>

          <div>
            <strong>78%</strong>
            <span>ACCURACY</span>
          </div>

          <div>
            <strong>22</strong>
            <span>BEST STREAK</span>
          </div>
        </div>
      </section>
    </div>
  );
} 