import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import BKIcon from "./BKIcon";
import {
  fetchPlayerById,
  normalizePlayerSearch,
  searchPlayers,
} from "../lib/playerService";

const EMPTY_EXCLUDED_IDS = [];

function getClubPreview(player) {
  const clubs = player?.main_clubs?.length ? player.main_clubs : player?.clubs || [];
  return clubs.slice(0, 3).join(" • ");
}

function getPlayerMeta(player, includeBirthYear = false) {
  return [
    getClubPreview(player),
    player?.position,
    includeBirthYear ? player?.birth_year : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function PlayerSuggestionRow({
  player,
  showMeta,
  showBirthYear,
  loading,
  onPointerDown,
  onPointerMove,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`player-picker-option ${loading ? "refreshing" : ""}`}
      key={player.id}
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onClick={onClick}
    >
      <span className="player-picker-option-copy">
        <strong>{player.name}</strong>
        {showMeta && (
          <small>
            {getPlayerMeta(player, showBirthYear)}
          </small>
        )}
      </span>
    </button>
  );
}

export default function PlayerPicker({
  value,
  onSelect,
  onSelectPlayer,
  placeholder = "Search player...",
  disabled = false,
  excludePlayerIds = EMPTY_EXCLUDED_IDS,
  compact = false,
  inputValue,
  onInputChange,
  onChangeText,
  onSubmit,
  autoSubmitOnSelect = false,
  showMeta = true,
  maxSuggestions = 4,
  autoFocus = false,
}) {
  const isQueryControlled = typeof inputValue === "string";
  const [query, setQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(
    value && typeof value === "object" ? value : null
  );
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSlowLoading, setShowSlowLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const dropdownPointerActiveRef = useRef(false);
  const pointerStartRef = useRef(null);
  const latestRequestRef = useRef(0);
  const cacheRef = useRef(new Map());
  const excludedKey = Array.isArray(excludePlayerIds)
    ? excludePlayerIds.join("|")
    : "";
  const excludedIds = useMemo(
    () => new Set(Array.isArray(excludePlayerIds) ? excludePlayerIds : []),
    [excludedKey]
  );
  const currentQuery = isQueryControlled ? inputValue : query;
  const visibleResults = results.slice(0, maxSuggestions);
  const duplicateVisibleNames = useMemo(() => {
    const counts = new Map();

    visibleResults.forEach((player) => {
      const key = normalizePlayerSearch(player.name);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
  }, [visibleResults]);
  const normalizedQuery = normalizePlayerSearch(currentQuery);
  const updateQuery = (nextQuery) => {
    if (isQueryControlled) {
      onInputChange?.(nextQuery);
      onChangeText?.(nextQuery);
    } else {
      setQuery(nextQuery);
      onChangeText?.(nextQuery);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!value || typeof value !== "string") {
      setSelectedPlayer(value && typeof value === "object" ? value : null);
      return undefined;
    }

    fetchPlayerById(value).then((player) => {
      if (!cancelled) setSelectedPlayer(player);
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    if (selectedPlayer) {
      setResults([]);
      setLoading(false);
      setShowSlowLoading(false);
      setHasSearched(false);
      setSearchError("");
      return undefined;
    }

    if (!normalizedQuery || normalizedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setShowSlowLoading(false);
      setHasSearched(false);
      setSearchError("");
      return undefined;
    }

    const cachedResults = cacheRef.current.get(normalizedQuery);
    if (cachedResults) {
      setResults(cachedResults.filter((player) => !excludedIds.has(player.id)));
      setHasSearched(true);
      setSearchError("");
      setLoading(false);
      setShowSlowLoading(false);
      return undefined;
    }

    setLoading(true);
    setShowSlowLoading(false);
    setSearchError("");

    const slowLoadingTimeout = window.setTimeout(() => {
      if (!cancelled && latestRequestRef.current === requestId && results.length === 0) {
        setShowSlowLoading(true);
      }
    }, 250);

    const timeout = window.setTimeout(async () => {
      const { players, error } = await searchPlayers(
        normalizedQuery,
        Math.max(8, maxSuggestions * 2)
      );

      if (cancelled || latestRequestRef.current !== requestId) return;

      window.clearTimeout(slowLoadingTimeout);
      const nextResults = players.filter((player) => !excludedIds.has(player.id));
      if (
        import.meta.env?.DEV ||
        (typeof document !== "undefined" &&
          (document.body.classList.contains("capacitor-ios") ||
            document.body.classList.contains("capacitor-ios-debug")))
      ) {
        console.log("[ios-search]", normalizedQuery, nextResults.length);
      }
      cacheRef.current.set(normalizedQuery, players);
      setResults(nextResults);
      setSearchError(error ? "Could not search players" : "");
      setLoading(false);
      setShowSlowLoading(false);
      setHasSearched(true);
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.clearTimeout(slowLoadingTimeout);
    };
  }, [normalizedQuery, selectedPlayer, excludedIds]);

  const selectPlayer = (player) => {
    setSelectedPlayer(player);
    updateQuery("");
    setResults([]);
    setHasSearched(false);
    setDropdownOpen(false);
    setSearchError("");
    onSelect?.(player);
    onSelectPlayer?.(player);
    if (autoSubmitOnSelect) {
      window.setTimeout(() => onSubmit?.(player), 0);
    }
  };

  const clearPlayer = () => {
    setSelectedPlayer(null);
    updateQuery("");
    setResults([]);
    setHasSearched(false);
    setDropdownOpen(true);
    setSearchError("");
    onSelect?.(null);
    onSelectPlayer?.(null);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  };

  const handleInputFocus = () => {
    window.clearTimeout(blurTimeoutRef.current);
    setDropdownOpen(true);
  };

  const handleInputBlur = () => {
    window.clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = window.setTimeout(() => {
      if (dropdownPointerActiveRef.current) {
        setDropdownOpen(true);
        return;
      }

      setDropdownOpen(false);
    }, 260);
  };

  const handleDropdownPointerDown = () => {
    dropdownPointerActiveRef.current = true;
    window.clearTimeout(blurTimeoutRef.current);
    setDropdownOpen(true);
  };

  const handleDropdownPointerUp = () => {
    window.setTimeout(() => {
      dropdownPointerActiveRef.current = false;
    }, 180);
  };

  const handleOptionPointerDown = (event) => {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };

  const handleOptionPointerMove = (event) => {
    if (!pointerStartRef.current) return;

    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);

    if (deltaX > 8 || deltaY > 8) {
      pointerStartRef.current.moved = true;
    }
  };

  const handleOptionClick = (player) => {
    if (pointerStartRef.current?.moved) {
      pointerStartRef.current = null;
      return;
    }

    pointerStartRef.current = null;
    selectPlayer(player);
  };

  const shouldShowDropdown =
    dropdownOpen &&
    normalizedQuery.length >= 2 &&
    (results.length > 0 || showSlowLoading || hasSearched || searchError);

  const dropdownContent = shouldShowDropdown ? (
    <div
      className="player-picker-results"
      style={{ "--player-picker-max": maxSuggestions }}
      onPointerDownCapture={handleDropdownPointerDown}
      onPointerUpCapture={handleDropdownPointerUp}
      onPointerCancelCapture={handleDropdownPointerUp}
    >
      {showSlowLoading && results.length === 0 && (
        <div className="player-picker-empty">Searching...</div>
      )}

      {visibleResults.map((player) => (
        <PlayerSuggestionRow
          key={player.id}
          player={player}
          showMeta={showMeta}
          showBirthYear={duplicateVisibleNames.get(normalizePlayerSearch(player.name)) > 1}
          loading={loading}
          onPointerDown={handleOptionPointerDown}
          onPointerMove={handleOptionPointerMove}
          onClick={() => handleOptionClick(player)}
        />
      ))}

      {loading && results.length > 0 && (
        <div className="player-picker-subtle-loading">Updating...</div>
      )}

      {!loading && searchError && results.length === 0 && (
        <div className="player-picker-empty error">{searchError}</div>
      )}

      {!loading && !searchError && hasSearched && results.length === 0 && (
        <div className="player-picker-empty">No players found</div>
      )}
    </div>
  ) : null;

  return (
    <div className={`player-picker ${compact ? "compact" : ""}`}>
      {selectedPlayer ? (
        <div className="player-picker-selected">
          <div className="player-picker-avatar">
            {selectedPlayer.image_url ? (
              <img src={selectedPlayer.image_url} alt="" />
            ) : (
              <BKIcon name="profile" size={28} />
            )}
          </div>

          <div className="player-picker-selected-copy">
            <strong>{selectedPlayer.name}</strong>
            <span>{getPlayerMeta(selectedPlayer, Boolean(selectedPlayer.birth_year))}</span>
            {getClubPreview(selectedPlayer) && <small>{getClubPreview(selectedPlayer)}</small>}
          </div>

          <button
            type="button"
            className="player-picker-clear"
            onClick={clearPlayer}
            disabled={disabled}
            aria-label="Clear selected player"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            className="player-picker-input"
            value={currentQuery}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit?.();
            }}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            spellCheck="false"
            autoFocus={autoFocus}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />

          {dropdownContent && typeof document !== "undefined"
            ? dropdownContent
            : null}
        </>
      )}
    </div>
  );
}
