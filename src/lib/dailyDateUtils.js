export function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey, amount) {
  const [year, month, day] = String(dateKey || getTodayDateKey())
    .split("-")
    .map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + amount);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function formatDisplayDate(dateKey) {
  const [year, month, day] = String(dateKey || getTodayDateKey())
    .split("-")
    .map(Number);

  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(
    undefined,
    { month: "long", day: "numeric", year: "numeric" }
  );
}

export function isTodayOrFuture(dateKey) {
  return String(dateKey || "") >= getTodayDateKey();
}

export function isSameDateKey(a, b) {
  return String(a || "") === String(b || "");
}
