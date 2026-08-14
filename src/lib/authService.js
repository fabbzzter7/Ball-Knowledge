function normalizeUsername(username = "") {
  return username.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isAnonymousAuthUser(user) {
  if (!user) return false;

  return (
    user.is_anonymous === true ||
    user.app_metadata?.provider === "anonymous" ||
    user.identities?.some((identity) => identity.provider === "anonymous")
  );
}

export function getFriendlyAuthErrorMessage(error, fallback = "Could not authenticate") {
  const rawMessage = String(error?.message || error || "");
  const message = rawMessage.toLowerCase();

  if (
    error?.name === "AuthRetryableFetchError" ||
    error?.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("fetch")
  ) {
    return "Could not reach Ball Knowledge online services. Check your connection and try again.";
  }

  if (
    message.includes("anonymous sign-ins are disabled") ||
    message.includes("anonymous sign in is disabled") ||
    message.includes("signups not allowed")
  ) {
    return "Guest online play is not enabled yet. Enable anonymous sign-in in Supabase, then try again.";
  }

  if (
    message.includes("invalid login credentials") ||
    message.includes("email not confirmed")
  ) {
    return rawMessage;
  }

  return rawMessage || fallback;
}

export function isValidUsername(username = "") {
  return /^[a-zA-Z0-9_.-]{3,18}$/.test(username.trim());
}

export function getUsernameError(username = "") {
  const trimmed = username.trim();

  if (!trimmed) return "Choose a username";
  if (trimmed.length < 3) return "Username must be at least 3 characters";
  if (trimmed.length > 18) return "Username must be 18 characters or less";
  if (!isValidUsername(trimmed)) {
    return "Use letters, numbers, dots, dashes or underscores";
  }

  return "";
}

export async function getCurrentSession(supabase) {
  if (!supabase?.auth) return { session: null, user: null, error: null };

  try {
    const { data, error } = await supabase.auth.getSession();
    return {
      session: data?.session || null,
      user: data?.session?.user || null,
      error,
    };
  } catch (error) {
    return { session: null, user: null, error };
  }
}

export async function signInWithEmail(supabase, { email, password }) {
  if (!supabase?.auth) {
    return { session: null, user: null, error: new Error("Auth is unavailable") };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return {
      session: data?.session || null,
      user: data?.user || null,
      error,
    };
  } catch (error) {
    return { session: null, user: null, error };
  }
}

export async function signUpWithEmailUsername(
  supabase,
  { email, password, username }
) {
  if (!supabase?.auth) {
    return { session: null, user: null, error: new Error("Auth is unavailable") };
  }

  const usernameError = getUsernameError(username);
  if (usernameError) {
    return { session: null, user: null, error: new Error(usernameError) };
  }

  const cleanUsername = username.trim();
  const usernameNormalized = normalizeUsername(cleanUsername);

  let existingProfile = null;
  let lookupError;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username_normalized", usernameNormalized)
      .maybeSingle();

    existingProfile = data;
    lookupError = error;
  } catch (error) {
    lookupError = error;
  }

  if (lookupError) {
    const message = String(lookupError.message || "").toLowerCase();

    return {
      session: null,
      user: null,
      error: new Error(
        message.includes("username_normalized") ||
          message.includes("schema cache")
          ? "Account setup is not finished. Run the Supabase auth SQL first."
          : lookupError.message || "Could not check username"
      ),
    };
  }

  if (existingProfile) {
    return {
      session: null,
      user: null,
      error: new Error("That username is already taken"),
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: cleanUsername,
          display_name: cleanUsername,
          username_normalized: usernameNormalized,
        },
      },
    });

    return {
      session: data?.session || null,
      user: data?.user || null,
      error,
      username: cleanUsername,
      usernameNormalized,
    };
  } catch (error) {
    return {
      session: null,
      user: null,
      error,
      username: cleanUsername,
      usernameNormalized,
    };
  }
}

export async function signInAnonymously(supabase, { username } = {}) {
  if (!supabase?.auth) {
    return { session: null, user: null, error: new Error("Auth is unavailable") };
  }

  const cleanUsername = username?.trim?.() || "";
  const authData = cleanUsername
    ? {
        username: cleanUsername,
        display_name: cleanUsername,
        username_normalized: normalizeUsername(cleanUsername),
        ball_knowledge_guest: true,
      }
    : { ball_knowledge_guest: true };

  try {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: authData },
    });

    return {
      session: data?.session || null,
      user: data?.user || null,
      error,
      username: cleanUsername,
    };
  } catch (error) {
    return { session: null, user: null, error, username: cleanUsername };
  }
}

export async function upgradeAnonymousUserWithEmail(
  supabase,
  { email, password, username, userId }
) {
  if (!supabase?.auth) {
    return { session: null, user: null, error: new Error("Auth is unavailable") };
  }

  const usernameError = getUsernameError(username);
  if (usernameError) {
    return { session: null, user: null, error: new Error(usernameError) };
  }

  const cleanUsername = username.trim();
  const usernameNormalized = normalizeUsername(cleanUsername);

  try {
    let profileLookup = supabase
      .from("profiles")
      .select("id")
      .eq("username_normalized", usernameNormalized);

    if (userId) {
      profileLookup = profileLookup.neq("id", userId);
    }

    const { data: existingProfile, error: lookupError } =
      await profileLookup.maybeSingle();

    if (lookupError) {
      return {
        session: null,
        user: null,
        error: lookupError,
        username: cleanUsername,
        usernameNormalized,
      };
    }

    if (existingProfile) {
      return {
        session: null,
        user: null,
        error: new Error("That username is already taken"),
        username: cleanUsername,
        usernameNormalized,
      };
    }

    const { data, error } = await supabase.auth.updateUser({
      email: email.trim(),
      password,
      data: {
        username: cleanUsername,
        display_name: cleanUsername,
        username_normalized: usernameNormalized,
        ball_knowledge_guest: false,
      },
    });

    const { data: sessionData } = await supabase.auth.getSession();

    return {
      session: sessionData?.session || null,
      user: data?.user || sessionData?.session?.user || null,
      error,
      username: cleanUsername,
      usernameNormalized,
    };
  } catch (error) {
    return {
      session: null,
      user: null,
      error,
      username: cleanUsername,
      usernameNormalized,
    };
  }
}

export async function signOut(supabase) {
  if (!supabase?.auth) return { error: null };

  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    return { error };
  }
}

export { normalizeUsername };
