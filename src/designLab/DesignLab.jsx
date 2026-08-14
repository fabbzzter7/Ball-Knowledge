import { useMemo, useState } from "react";
import HomeConcept from "./screens/HomeConcept";
import SinglePlayerConcept from "./screens/SinglePlayerConcept";
import GameplayConcept from "./screens/GameplayConcept";
import ResultConcept from "./screens/ResultConcept";
import LevelUpConcept from "./screens/LevelUpConcept";
import "./designLab.css";

const concepts = [
  { id: "home", label: "Home", Component: HomeConcept },
  { id: "single-player", label: "Single Player", Component: SinglePlayerConcept },
  { id: "gameplay", label: "Gameplay", Component: GameplayConcept },
  { id: "result", label: "Result", Component: ResultConcept },
  { id: "level-up", label: "Level Up", Component: LevelUpConcept },
];

export default function DesignLab() {
  const [activeConceptId, setActiveConceptId] = useState(concepts[0].id);
  const activeConcept = useMemo(
    () => concepts.find((concept) => concept.id === activeConceptId) || concepts[0],
    [activeConceptId]
  );
  const ActiveConcept = activeConcept.Component;

  return (
    <main className="dl-root">
      <aside className="dl-toolbar" aria-label="Design Lab screen selector">
        <div>
          <strong>BK Design Lab</strong>
          <span>Mock-only visual sandbox</span>
        </div>
        <div className="dl-tabs">
          {concepts.map((concept) => (
            <button
              type="button"
              key={concept.id}
              className={concept.id === activeConceptId ? "is-active" : ""}
              onClick={() => setActiveConceptId(concept.id)}
            >
              {concept.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="dl-preview-shell" aria-label={`${activeConcept.label} concept preview`}>
        <div className="dl-device-frame">
          <ActiveConcept />
        </div>
      </section>
    </main>
  );
}
