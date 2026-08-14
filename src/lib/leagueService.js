import {
  buildLeagueDailyQuestionIds,
  buildLeagueWhoAmIQuestionIds,
  getLeagueDayNumber,
  getLeagueQuestionsByIds,
  getLeagueSettingsSummary,
  getLeagueTop10Challenge,
  getLeagueWhoAmIQuestionsByIds,
  getTodayKey,
  hasLeagueTop10ChallengeId,
} from "./leagueChallengeUtils";

async function getSearchableLeagueWhoAmIQuestionIds(seed, count) {
  const { filterSearchablePlayerGuessQuestions } = await import("./playerService");
  const candidateIds = await buildLeagueWhoAmIQuestionIds(
    seed,
    Math.max(count * 4, count + 12)
  );
  const candidates = await getLeagueWhoAmIQuestionsByIds(candidateIds);
  const searchableQuestions = await filterSearchablePlayerGuessQuestions(
    candidates,
    "league-whoami"
  );

  return searchableQuestions.slice(0, count).map((question) => question.id);
}

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
  return /duration_days|quiz_count|top10_count|whoami_count|find_player_count|find_player_scoring_mode|max_daily_points|league_format|whoami_question_ids|find_player_target_ids|whoami_score|find_player_score|find_player_attempts|find_player_time_seconds/i.test(
    error?.message || ""
  );
}

function toArrayField(value) {
  return Array.isArray(value) ? value : [];
}

export async function createLeague(supabase, { name, playerId, username, settings = {} }) {
  const leagueCode = await createUniqueLeagueCode(supabase);
  const leagueName = name?.trim() || `${username || "Ball Knowledge"}'s League`;
  const quizCount = Number(settings.quizCount ?? 5);
  const top10Count = Number(settings.top10Count ?? 1);
  const whoamiCount = Number(settings.whoamiCount ?? 0);
  const findPlayerCount = 0;
  const maxDailyPoints =
    quizCount + top10Count * 10 + whoamiCount * 10;
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
      whoami_count: whoamiCount,
      find_player_count: findPlayerCount,
      find_player_scoring_mode: settings.findPlayerScoringMode || "attempts",
      max_daily_points: maxDailyPoints,
      league_format: settings.leagueFormat || "custom",
    })
    .select()
    .single();

  if (leagueError && isMissingSettingsColumnError(leagueError)) {
    if (whoamiCount > 0) {
      return {
        league: null,
        error: new Error(
          "Missing league challenge columns. Run the latest league SQL."
        ),
      };
    }

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

  const memberPayload = {
    league_id: league.id,
    player_id: playerId,
    username,
    total_points: 0,
    days_played: 0,
  };

  let { error: memberError } = await supabase
    .from("league_members")
    .insert(memberPayload);

  if (memberError?.code === "23505") {
    const retry = await supabase
      .from("league_members")
      .update({
        username,
      })
      .eq("league_id", league.id)
      .eq("player_id", playerId);

    memberError = retry.error;
  }

  if (memberError) {
    memberError.message = `League was created, but creator membership could not be saved: ${memberError.message}`;
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

  let { error: memberError } = await supabase.from("league_members").insert({
    league_id: league.id,
    player_id: playerId,
    username,
  });

  if (memberError?.code === "23505") {
    memberError = null;
  }

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

  const todayKey = getTodayKey();
  const [
    { data: leagues, error: leagueError },
    { data: allMembers },
    { data: todaySubmissions },
  ] = await Promise.all([
    supabase.from("leagues").select("*").in("id", leagueIds),
    supabase.from("league_members").select("*").in("league_id", leagueIds),
    supabase
      .from("league_submissions")
      .select("league_id, player_id, total_points")
      .in("league_id", leagueIds)
      .gte("completed_at", `${todayKey}T00:00:00`),
  ]);

  if (leagueError) return { leagues: [], error: leagueError };

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

export async function leaveLeague(supabase, { leagueId, playerId }) {
  if (!leagueId || !playerId) {
    return { left: false, archived: false, transferredTo: null, error: new Error("Missing league or player") };
  }

  const [{ data: league, error: leagueError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase.from("leagues").select("*").eq("id", leagueId).maybeSingle(),
      supabase.from("league_members").select("*").eq("league_id", leagueId),
    ]);

  if (leagueError || !league) {
    return { left: false, archived: false, transferredTo: null, error: leagueError || new Error("League not found") };
  }

  if (membersError) {
    return { left: false, archived: false, transferredTo: null, error: membersError };
  }

  const currentMember = (members || []).find((member) => member.player_id === playerId);
  if (!currentMember) {
    return { left: false, archived: false, transferredTo: null, error: new Error("You are not a member of this league") };
  }

  const isCreator = league.created_by_id === playerId;
  const otherMembers = (members || [])
    .filter((member) => member.player_id !== playerId)
    .sort((a, b) => {
      const pointsDiff = (b.total_points || 0) - (a.total_points || 0);
      if (pointsDiff) return pointsDiff;
      return String(a.joined_at || "").localeCompare(String(b.joined_at || ""));
    });

  if (isCreator && otherMembers.length > 0) {
    const nextOwner = otherMembers[0];
    const { error: transferError } = await supabase
      .from("leagues")
      .update({
        created_by_id: nextOwner.player_id,
        created_by_username: nextOwner.username,
      })
      .eq("id", leagueId)
      .eq("created_by_id", playerId);

    if (transferError) {
      return { left: false, archived: false, transferredTo: null, error: transferError };
    }
  }

  if (isCreator && otherMembers.length === 0) {
    const { error: archiveError } = await supabase
      .from("leagues")
      .update({ status: "archived" })
      .eq("id", leagueId)
      .eq("created_by_id", playerId);

    if (archiveError) {
      return { left: false, archived: false, transferredTo: null, error: archiveError };
    }
  }

  const { error: deleteMemberError } = await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("player_id", playerId);

  if (deleteMemberError) {
    return { left: false, archived: false, transferredTo: null, error: deleteMemberError };
  }

  return {
    left: true,
    archived: isCreator && otherMembers.length === 0,
    transferredTo: isCreator && otherMembers.length > 0 ? otherMembers[0] : null,
    error: null,
  };
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

  const rawSettings = getLeagueSettingsSummary(league);
  const settings = {
    ...rawSettings,
    findPlayerCount: 0,
    findPlayerScoringMode: "attempts",
    maxDailyPoints:
      rawSettings.quizCount + rawSettings.top10Count * 10 + rawSettings.whoamiCount * 10,
  };
  const seed = `${league.id}:${dayKey}`;
  const quizQuestionIds = await buildLeagueDailyQuestionIds(seed, settings.quizCount);
  const whoamiQuestionIds =
    settings.whoamiCount > 0
      ? await getSearchableLeagueWhoAmIQuestionIds(seed, settings.whoamiCount)
      : [];
  const top10Challenge =
    settings.top10Count > 0 ? getLeagueTop10Challenge(seed) : null;

  if (
    quizQuestionIds.length !== settings.quizCount ||
    whoamiQuestionIds.length !== settings.whoamiCount ||
    (settings.top10Count > 0 && !top10Challenge)
  ) {
    return { leagueDay: null, error: new Error("No valid league challenge available") };
  }

  if (existingError) return { leagueDay: null, error: existingError };
  if (existingDay) {
    const savedQuizIds = toArrayField(existingDay.quiz_question_ids);
    const savedWhoAmIIds = toArrayField(existingDay.whoami_question_ids);
    const savedQuizQuestions = await getLeagueQuestionsByIds(savedQuizIds);
    const savedWhoAmIQuestions = settings.whoamiCount > 0
      ? await (async () => {
          const { filterSearchablePlayerGuessQuestions } = await import("./playerService");
          return filterSearchablePlayerGuessQuestions(
            await getLeagueWhoAmIQuestionsByIds(savedWhoAmIIds),
            "saved-league-whoami"
          );
        })()
      : [];
    const needsQuizIds =
      settings.quizCount > 0 &&
      (savedQuizIds.length !== settings.quizCount ||
        savedQuizQuestions.length !== settings.quizCount);
    const needsWhoAmIIds =
      settings.whoamiCount > 0 &&
      (savedWhoAmIIds.length !== settings.whoamiCount ||
        savedWhoAmIQuestions.length !== settings.whoamiCount);
    const needsTop10Id =
      settings.top10Count > 0 &&
      !hasLeagueTop10ChallengeId(existingDay.top10_challenge_id);

    if (!needsQuizIds && !needsWhoAmIIds && !needsTop10Id) {
      return { leagueDay: existingDay, error: null };
    }

    const updatePayload = {};
    if (needsQuizIds) updatePayload.quiz_question_ids = quizQuestionIds;
    if (needsWhoAmIIds) updatePayload.whoami_question_ids = whoamiQuestionIds;
    if (needsTop10Id) updatePayload.top10_challenge_id = top10Challenge?.id || null;

    const { data: updatedDay, error: updateError } = await supabase
      .from("league_days")
      .update(updatePayload)
      .eq("id", existingDay.id)
      .select()
      .single();

    if (updateError) {
      return {
        leagueDay: null,
        error:
          isMissingSettingsColumnError(updateError) && needsWhoAmIIds
            ? new Error(
                "Missing league challenge columns. Run the latest league SQL."
              )
            : updateError,
      };
    }

    return { leagueDay: updatedDay || existingDay, error: null };
  }

  const insertPayload = {
    league_id: league.id,
    day_key: dayKey,
    day_number: dayNumber,
    quiz_question_ids: quizQuestionIds,
    top10_challenge_id: top10Challenge?.id || null,
    whoami_question_ids: whoamiQuestionIds,
  };
  const { data: leagueDay, error } = await supabase
    .from("league_days")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    if (
      isMissingSettingsColumnError(error) &&
      settings.whoamiCount > 0
    ) {
      return {
        leagueDay: null,
        error: new Error(
          "Missing league challenge columns. Run the latest league SQL."
        ),
      };
    }

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
  {
    league,
    leagueDay,
    playerId,
    username,
    quizScore,
    top10Score,
    whoamiScore = 0,
  }
) {
  const totalPoints = quizScore + top10Score + whoamiScore;

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

  let { data: submission, error: submissionError } = await supabase
    .from("league_submissions")
    .insert({
      league_id: league.id,
      league_day_id: leagueDay.id,
      player_id: playerId,
      username,
      quiz_score: quizScore,
      top10_score: top10Score,
      whoami_score: whoamiScore,
      total_points: totalPoints,
    })
    .select()
    .single();

  if (submissionError && isMissingSettingsColumnError(submissionError)) {
    const retry = await supabase
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

    submission = retry.data;
    submissionError = retry.error;
  }

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
