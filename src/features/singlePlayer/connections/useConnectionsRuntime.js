import { useEffect, useMemo, useRef, useState } from "react";

function shuffle(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
}

function buildConnectionsTiles(puzzle) {
  return shuffle(
    puzzle.groups.flatMap((group, groupIndex) =>
      group.items.map((item) => ({
        id: `${puzzle.id}-${groupIndex}-${item}`,
        item,
        groupIndex,
      }))
    )
  );
}

export default function useConnectionsRuntime({
  puzzle,
  rewardModal,
  onComplete,
  playClickSound,
  playCorrectSound,
  playWrongSound,
}) {
  const [tiles, setTiles] = useState(() => buildConnectionsTiles(puzzle));
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [shake, setShake] = useState(0);
  const clearSelectionTimerRef = useRef(null);
  const completionReportedRef = useRef(false);

  const solvedIndexes = useMemo(
    () => solved.map((group) => group.index),
    [solved]
  );
  const gameComplete = solved.length === 4;
  const gameOver =
    Boolean(puzzle) &&
    mistakes >= 4 &&
    solved.length < 4 &&
    !gameComplete;
  const visibleTiles = useMemo(
    () => tiles.filter((tile) => !solvedIndexes.includes(tile.groupIndex)),
    [solvedIndexes, tiles]
  );
  const mistakesLeft = Math.max(0, 4 - mistakes);

  useEffect(() => {
    return () => {
      if (clearSelectionTimerRef.current) {
        window.clearTimeout(clearSelectionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gameComplete || completionReportedRef.current) return;

    completionReportedRef.current = true;
    setFeedback({ type: "complete", text: "+75 coins earned" });
    onComplete?.({ puzzle, solved, mistakes });
  }, [gameComplete, mistakes, onComplete, puzzle, solved]);

  const toggleTile = (tile) => {
    if (rewardModal || gameComplete || gameOver) return;

    playClickSound?.();
    setFeedback(null);

    setSelected((selectedTiles) => {
      if (selectedTiles.includes(tile.id)) {
        return selectedTiles.filter((tileId) => tileId !== tile.id);
      }

      if (selectedTiles.length >= 4) return selectedTiles;

      return [...selectedTiles, tile.id];
    });
  };

  const clearSelection = () => {
    playClickSound?.();
    setSelected([]);
    setFeedback(null);
  };

  const shuffleTiles = () => {
    if (rewardModal || gameComplete || gameOver) return;

    playClickSound?.();
    setTiles((currentTiles) => shuffle(currentTiles));
  };

  const submitSelection = () => {
    if (
      !puzzle ||
      selected.length !== 4 ||
      gameComplete ||
      gameOver ||
      rewardModal
    ) {
      return;
    }

    const selectedTiles = tiles.filter((tile) => selected.includes(tile.id));
    const groupCounts = selectedTiles.reduce((counts, tile) => {
      counts[tile.groupIndex] = (counts[tile.groupIndex] || 0) + 1;
      return counts;
    }, {});
    const solvedGroupIndex = Number(
      Object.entries(groupCounts).find(([, count]) => count === 4)?.[0]
    );

    if (
      Number.isInteger(solvedGroupIndex) &&
      !solvedIndexes.includes(solvedGroupIndex)
    ) {
      const solvedGroup = puzzle.groups[solvedGroupIndex];

      setSolved((groups) => [
        ...groups,
        {
          ...solvedGroup,
          index: solvedGroupIndex,
          solvedItems: selectedTiles.map((tile) => tile.item),
        },
      ]);
      setSelected([]);
      setFeedback({ type: "correct", text: "Correct group" });
      playCorrectSound?.();
      return;
    }

    const isOneAway = Object.values(groupCounts).some((count) => count === 3);
    const nextMistakes = mistakes + 1;

    setMistakes(nextMistakes);
    setFeedback({
      type: isOneAway ? "close" : "wrong",
      text: isOneAway ? "One away" : "Try again",
    });
    setShake((value) => value + 1);
    playWrongSound?.();

    clearSelectionTimerRef.current = window.setTimeout(() => {
      setSelected([]);
      clearSelectionTimerRef.current = null;
    }, 450);
  };

  return {
    solved,
    visibleTiles,
    selected,
    mistakes,
    mistakesLeft,
    feedback,
    shake,
    gameComplete,
    gameOver,
    toggleTile,
    clearSelection,
    shuffleTiles,
    submitSelection,
  };
}
