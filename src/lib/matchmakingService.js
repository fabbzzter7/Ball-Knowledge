function createRoomCode() {
  return `BK-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function findOrCreatePublicMatch(supabase, { playerId, username }) {
  const { data: waitingMatches, error: searchError } = await supabase
    .from("matches")
    .select("*")
    .eq("is_public", true)
    .eq("status", "waiting")
    .neq("player1_id", playerId)
    .order("created_at", { ascending: true })
    .limit(5);

  if (searchError) return { match: null, created: false, joined: false, error: searchError };

  const matchToJoin = (waitingMatches || []).find((match) => !match.player2_id);

  if (matchToJoin) {
    const { data: updatedMatch, error: updateError } = await supabase
      .from("matches")
      .update({
        player2_username: username,
        player2_id: playerId,
        status: "ready",
        matchmaking_status: "matched",
        phase: "choose_category",
        current_turn: matchToJoin.player1_username,
        current_turn_id: matchToJoin.player1_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchToJoin.id)
      .eq("status", "waiting")
      .select()
      .single();

    if (updateError || !updatedMatch) {
      return { match: null, created: false, joined: false, error: updateError };
    }

    await supabase.from("match_players").insert({
      match_id: updatedMatch.id,
      username,
      player_id: playerId,
      player_slot: "player2",
    });

    return { match: updatedMatch, created: false, joined: true, error: null };
  }

  const roomCode = createRoomCode();
  const { data: match, error: createError } = await supabase
    .from("matches")
    .insert({
      room_code: roomCode,
      mode: "general",
      created_by: username,
      current_turn: username,
      current_turn_id: playerId,
      player1_username: username,
      player1_id: playerId,
      status: "waiting",
      phase: "waiting_for_opponent",
      round_number: 0,
      is_public: true,
      matchmaking_status: "waiting",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError || !match) {
    return { match: null, created: false, joined: false, error: createError };
  }

  await supabase.from("match_players").insert({
    match_id: match.id,
    username,
    player_id: playerId,
    player_slot: "player1",
  });

  return { match, created: true, joined: false, error: null };
}
