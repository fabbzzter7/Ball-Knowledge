import {
  buildLeagueDailyQuestionIds,
  getLeagueDayNumber,
  getLeagueSettingsSummary,
  getLeagueTop10Challenge,
  getTodayKey,
} from "./leagueChallengeUtils";

export function generateLeagueCode() {
  return `LG-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function createUniqueLeagueCode(supabase) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateLeagueCode();
    const { data } = await supabase
      .from("leagues")
      .select("id")
      .eq("league_code", code)
      .maybeSingle();

    if (!data) return code;
  }

  return `LG-${Date.now().toString().slice(-4)}`;
}

function isMissingSettingsColumnError(error) {
  return /duration_days|quiz_count|top10_count|max_daily_points|league_format/i.test(
    error?.message || ""
  );
}

export async function createLeague(supabase, { name, playerId, username, settings = {} }) {
  const leagueCode = await createUniqueLeagueCode(supabase);
  const leagueName = name?.trim() || `${username || "Ball Knowledge"}'s League`;
  const quizCount = Number(settings.quizCount ?? 5);
  const top10Count = Number(settings.top10Count ?? 1);
  const maxDailyPoints = quizCount + top10Count * 10;
  const baseInsert = {
    league_code: leagueCode,
    name: leagueName,
    created_by_id: playerId,
    created_by_username: username,
    status: "active",
  };

  let { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      ...baseInsert,
      duration_days: settings.durationDays,
      quiz_count: quizCount,
      top10_count: top10Count,
      max_daily_points: maxDailyPoints,
      league_format: settings.leagueFormat || "balanced",
    })
    .select()
    .single();

  if (leagueError && isMissingSettingsColumnError(leagueError)) {
    const retry = await supabase
      .from("leagues")
      .insert(baseInsert)
      .select()
      .single();

    league = retry.data;
    leagueError = retry.error;
  }

  if (leagueError || !league) {
    return { league: null, error: leagueError || new Error("League not created") };
  }

  const { error: memberError } = await supabase.from("league_members").insert({
    league_id: league.id,
    player_id: playerId,
    username,
    total_points: 0,
    days_played: 0,
  });

  if (memberError) {
    return { league, error: memberError };
  }

  return { league, error: null };
}

export async function joinLeague(supabase, { code, playerId, username }) {
  const leagueCode = code.trim().toUpperCase();
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("league_code", leagueCode)
    .maybeSingle();

  if (leagueError) return { league: null, alreadyJoined: false, error: leagueError };
  if (!league) return { league: null, alreadyJoined: false, error: new Error("League not found") };

  const { data: existingMember, error: existingError } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", league.id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingError) return { league, alreadyJoined: false, error: existingError };
  if (existingMember) return { league, alreadyJoined: true, error: null };

  const { error: memberError } = await supabase.from("league_members").insert({
    league_id: league.id,
    player_id: playerId,
    username,
  });

  return { league, alreadyJoined: false, error: memberError || null };
}

export async function fetchMyLeagues(supabase, playerId) {
  const { data: memberships, error: membershipError } = await supabase
    .from("league_members")
    .select("*")
    .eq("player_id", playerId)
    .order("joined_at", { ascending: false });

  if (membershipError) return { leagues: [], error: membershipError };

  const leagueIds = [...new Set((memberships || []).map((member) => member.league_id))];
  if (!leagueIds.length) return { leagues: [], error: null };

  const { data: leagues, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .in("id", leagueIds);

  if (leagueError) return { leagues: [], error: leagueError };

  const todayKey = getTodayKey();
  const { data: allMembers } = await supabase
    .from("league_members")
    .select("*")
    .in("league_id", leagueIds);
  const { data: todaySubmissions } = await supabase
    .from("league_submissions")
    .select("league_id, player_id, total_points")
    .in("league_id", leagueIds)
    .gte("completed_at", `${todayKey}T00:00:00`);

  const rows = (leagues || []).map((league) => {
    const members = (allMembers || []).filter((member) => member.league_id === league.id);
    const sortedMembers = [...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
    const currentMember = members.find((member) => member.player_id === playerId);
    const todayPlayed = (todaySubmissions || []).some(
      (submission) => submission.league_id === league.id && submission.player_id === playerId
    );

    return {
      league,
      member: currentMember,
      memberCount: members.length,
      rank: sortedMembers.findIndex((member) => member.player_id === playerId) + 1 || null,
      todayPlayed,
    };
  });

  return { leagues: rows, error: null };
}

export async function getOrCreateLeagueDay(supabase, league) {
  const dayKey = getTodayKey();
  const dayNumber = getLeagueDayNumber(league.start_date, dayKey);

  const { data: existingDay, error: existingError } = await supabase
    .from("league_days")
    .select("*")
    .eq("league_id", league.id)
    .eq("day_key", dayKey)
    .maybeSingle();

  if (existingError) return { leagueDay: null, error: existingError };
  if (existingDay) return { leagueDay: existingDay, error: null };

  const settings = getLeagueSettingsSummary(league);
  const seed = `${league.id}:${dayKey}`;
  const quizQuestionIds = buildLeagueDailyQuestionIds(seed, settings.quizCount);
  const top10Challenge =
    settings.top10Count > 0 ? getLeagueTop10Challenge(seed) : null;

  if (
    quizQuestionIds.length !== settings.quizCount ||
    (settings.top10Count > 0 && !top10Challenge)
  ) {
    return { leagueDay: null, error: new Error("No valid league challenge available") };
  }

  const { data: leagueDay, error } = await supabase
    .from("league_days")
    .insert({
      league_id: league.id,
      day_key: dayKey,
      day_number: dayNumber,
      quiz_question_ids: quizQuestionIds,
      top10_challenge_id: top10Challenge?.id || null,
    })
    .select()
    .single();

  if (error) {
    const { data: duplicateDay } = await supabase
      .from("league_days")
      .select("*")
      .eq("league_id", league.id)
      .eq("day_key", dayKey)
      .maybeSingle();

    if (duplicateDay) return { leagueDay: duplicateDay, error: null };
  }

  return { leagueDay, error: error || null };
}

export async function fetchLeagueDashboard(supabase, leagueId, playerId) {
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return { dashboard: null, error: leagueError || new Error("League not found") };
  }

  const [{ data: members, error: membersError }, { leagueDay, error: dayError }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("*")
        .eq("league_id", league.id)
        .order("total_points", { ascending: false }),
      getOrCreateLeagueDay(supabase, league),
    ]);

  if (membersError || dayError || !leagueDay) {
    return { dashboard: null, error: membersError || dayError };
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("league_submissions")
    .select("*")
    .eq("league_day_id", leagueDay.id)
    .order("total_points", { ascending: false });

  if (submissionsError) return { dashboard: null, error: submissionsError };

  return {
    dashboard: {
      league,
      members: members || [],
      leagueDay,
      submissions: submissions || [],
      currentSubmission:
        (submissions || []).find((submission) => submission.player_id === playerId) || null,
    },
    error: null,
  };
}

export async function submitLeagueDailyResult(
  supabase,
  { league, leagueDay, playerId, username, quizScore, top10Score }
) {
  const totalPoints = quizScore + top10Score;

  const { data: existingSubmission, error: existingError } = await supabase
    .from("league_submissions")
    .select("*")
    .eq("league_day_id", leagueDay.id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingError) return { submission: null, alreadySubmitted: false, error: existingError };
  if (existingSubmission) {
    return { submission: existingSubmission, alreadySubmitted: true, error: null };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("league_submissions")
    .insert({
      league_id: league.id,
      league_day_id: leagueDay.id,
      player_id: playerId,
      username,
      quiz_score: quizScore,
      top10_score: top10Score,
      total_points: totalPoints,
    })
    .select()
    .single();

  if (submissionError || !submission) {
    return { submission: null, alreadySubmitted: false, error: submissionError };
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", league.id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (member) {
    await supabase
      .from("league_members")
      .update({
        total_points: (member.total_points || 0) + totalPoints,
        days_played: (member.days_played || 0) + 1,
        username,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", member.id);
  }

  return { submission, alreadySubmitted: false, error: null };
}
