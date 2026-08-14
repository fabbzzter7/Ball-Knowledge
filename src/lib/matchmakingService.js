import { pickMultiplayerQuestionIds } from "../multiplayerQuestionBank";

function createRoomCode() {
  return `BK-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function normalizeRoomCode(roomCode = "") {
  return String(roomCode).trim().toUpperCase();
}

export function getPrivateJoinErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");

  if (message.includes("not_authenticated") || code === "42501") {
    return "Sign in or continue as Guest to join online matches.";
  }

  if (message.includes("invalid_room_code") || code === "22023") {
    return "Enter a valid BK room code.";
  }

  if (message.includes("room_not_found") || code === "P0002") {
    return "We couldn't find that room. Check the code and try again.";
  }

  if (message.includes("own_room")) {
    return "You're already the host of this battle.";
  }

  if (message.includes("room_full")) {
    return "That battle already has two players.";
  }

  if (message.includes("room_completed")) {
    return "That battle has already finished.";
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    error?.name === "TypeError"
  ) {
    return "Couldn't reach Ball Knowledge. Check your connection and try again.";
  }

  return "Could not join room. Check the code and try again.";
}

async function insertMatchPlayer(supabase, payload) {
  const { error } = await supabase.from("match_players").insert(payload);
  return error;
}

async function loadLatestRound(supabase, matchId) {
  const { data, error } = await supabase
    .from("multiplayer_rounds")
    .select("*")
    .eq("match_id", matchId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { round: data || null, error };
}

function getRpcMatch(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function isAnonymousAuthUser(user) {
  return Boolean(
    user?.is_anonymous === true ||
      user?.app_metadata?.provider === "anonymous" ||
      user?.identities?.some((identity) => identity.provider === "anonymous")
  );
}

async function getAuthUserForDiagnostics(supabase) {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch {
    return null;
  }
}

export async function findOrCreatePublicMatch(
  supabase,
  { playerId, username, categoryId = "general" }
) {
  const { data: waitingMatches, error: searchError } = await supabase
    .from("matches")
    .select("*")
    .eq("is_public", true)
    .eq("status", "waiting_for_opponent")
    .eq("matchmaking_status", "waiting_for_opponent")
    .is("player2_id", null)
    .neq("player1_id", playerId)
    .order("created_at", { ascending: true })
    .limit(8);

  if (searchError) {
    return { match: null, round: null, created: false, joined: false, error: searchError };
  }

  for (const matchToJoin of waitingMatches || []) {
    const { data: updatedMatch, error: updateError } = await supabase
      .from("matches")
      .update({
        player2_username: username,
        player2_id: playerId,
        status: "active",
        matchmaking_status: "matched",
        phase: "round_active",
        current_turn: username,
        current_turn_id: playerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchToJoin.id)
      .eq("status", "waiting_for_opponent")
      .eq("matchmaking_status", "waiting_for_opponent")
      .is("player2_id", null)
      .select()
      .maybeSingle();

    if (updateError || !updatedMatch) {
      continue;
    }

    await insertMatchPlayer(supabase, {
      match_id: updatedMatch.id,
      username,
      player_id: playerId,
      player_slot: "player2",
    });

    const { round, error: roundError } = await loadLatestRound(supabase, updatedMatch.id);
    return {
      match: updatedMatch,
      round,
      created: false,
      joined: true,
      error: roundError,
    };
  }

  const safeCategoryId = categoryId || "general";
  const questionIds = await pickMultiplayerQuestionIds(safeCategoryId, 5);

  if (questionIds.length !== 5) {
    return {
      match: null,
      round: null,
      created: false,
      joined: false,
      error: new Error("Not enough questions for Play Now"),
    };
  }

  const roomCode = createRoomCode();
  const { data: match, error: createError } = await supabase
    .from("matches")
    .insert({
      room_code: roomCode,
      mode: safeCategoryId,
      selected_category: safeCategoryId,
      created_by: username,
      current_turn: username,
      current_turn_id: playerId,
      player1_username: username,
      player1_id: playerId,
      status: "active",
      phase: "round_active",
      round_number: 1,
      is_public: true,
      matchmaking_status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError || !match) {
    return { match: null, round: null, created: false, joined: false, error: createError };
  }

  await insertMatchPlayer(supabase, {
    match_id: match.id,
    username,
    player_id: playerId,
    player_slot: "player1",
  });

  const { data: round, error: roundError } = await supabase
    .from("multiplayer_rounds")
    .insert({
      match_id: match.id,
      round_number: 1,
      category: safeCategoryId,
      chosen_by: username,
      question_ids: questionIds,
      player1_score: 0,
      player2_score: 0,
      player1_finished: false,
      player2_finished: false,
      status: "active",
    })
    .select()
    .single();

  if (roundError || !round) {
    return { match, round: null, created: true, joined: false, error: roundError };
  }

  return { match, round, created: true, joined: false, error: null };
}

export async function joinPrivateMatchByRoomCode(
  supabase,
  { roomCode, playerId }
) {
  if (!supabase) {
    return {
      match: null,
      error: new Error("Supabase is unavailable"),
      normalizedRoomCode: normalizeRoomCode(roomCode),
    };
  }

  if (!playerId) {
    return {
      match: null,
      error: new Error("not_authenticated"),
      normalizedRoomCode: normalizeRoomCode(roomCode),
    };
  }

  const normalizedRoomCode = normalizeRoomCode(roomCode);

  const authUser = import.meta.env?.DEV
    ? await getAuthUserForDiagnostics(supabase)
    : null;

  if (import.meta.env?.DEV) {
    console.log("[mp-private-join]", {
      stage: "request",
      normalizedRoomCode,
      authUserId: authUser?.id || playerId,
      isAnonymous: isAnonymousAuthUser(authUser),
    });
  }

  const { data, error } = await supabase.rpc("join_private_match_by_room_code", {
    p_room_code: normalizedRoomCode,
  });

  const match = getRpcMatch(data);

  if (error || !match) {
    if (import.meta.env?.DEV) {
      console.log("[mp-private-join]", {
        stage: "failure",
        normalizedRoomCode,
        authUserId: authUser?.id || playerId,
        isAnonymous: isAnonymousAuthUser(authUser),
        errorCode: error?.code,
        errorMessage: error?.message,
        errorDetails: error?.details,
        errorHint: error?.hint,
      });
    }

    return {
      match: null,
      error: error || new Error("room_not_found"),
      normalizedRoomCode,
    };
  }

  if (import.meta.env?.DEV) {
    console.log("[mp-private-join]", {
      stage: "success",
      normalizedRoomCode,
      authUserId: authUser?.id || playerId,
      isAnonymous: isAnonymousAuthUser(authUser),
      matchId: match.id,
      roomCode: match.room_code,
      player1Id: match.player1_id,
      player2Id: match.player2_id,
      status: match.status,
      phase: match.phase,
    });
  }

  return { match, error: null, normalizedRoomCode };
}
