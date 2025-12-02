/**
 * Generate calendar days for the next 365 days
 */
export function generateCalendarDays() {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      dateObj: d,
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('es-ES', { weekday: 'long' }),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('es-ES', { month: 'long' }),
      monthKey: `${d.getFullYear()}-${d.getMonth()}`,
      year: d.getFullYear(),
      month: d.getMonth()
    });
  }
  return days;
}

/**
 * Generate months navigation from calendar days
 */
export function generateMonthsNav(calendarDays) {
  const months = [];
  const seen = new Set();
  calendarDays.forEach(day => {
    if (!seen.has(day.monthKey)) {
      seen.add(day.monthKey);
      months.push({
        key: day.monthKey,
        name: day.monthName,
        year: day.year
      });
    }
  });
  return months;
}

/**
 * Generate calendar grid days for a specific month
 */
export function getCalendarGridDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = sunday

  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Empty days at start
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = dateObj.toISOString().split('T')[0];
    const isPast = dateObj < today;
    days.push({
      dateObj,
      dateStr,
      dayNum: d,
      isPast,
      dayName: dateObj.toLocaleDateString('es-ES', { weekday: 'long' }),
      monthName: dateObj.toLocaleDateString('es-ES', { month: 'long' })
    });
  }

  return days;
}

/**
 * Generate personal calendar grid for a month
 */
export function getPersonalCalendarDays(year, month) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Find Monday of first week
  const startOfCalendar = new Date(firstDayOfMonth);
  const dayOfWeek = firstDayOfMonth.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfCalendar.setDate(firstDayOfMonth.getDate() + diff);

  // Generate 42 days (6 weeks)
  for (let i = 0; i < 42; i++) {
    const date = new Date(startOfCalendar);
    date.setDate(startOfCalendar.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isCurrentMonth = date.getMonth() === month && date.getFullYear() === year;

    // Stop if we've passed the last day and it's a new week
    if (i >= 35 && date > lastDayOfMonth && date.getDay() === 1) {
      break;
    }

    days.push({
      dateObj: date,
      dateStr,
      dayNum: date.getDate(),
      isPast,
      isToday,
      isCurrentMonth
    });
  }

  return days;
}

/**
 * Format date for display
 */
export function formatDate(dateStr, options = {}) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...options
  });
}

/**
 * Format time for display
 */
export function formatTime(timestamp) {
  const time = new Date(timestamp);
  if (time.getFullYear() <= 1970) return '';
  return time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format date for chat separator
 */
export function formatDateSeparator(timestamp) {
  const time = new Date(timestamp);
  return time.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/**
 * Get current month name with year
 */
export function getCurrentMonthName(year, month) {
  return new Date(year, month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

/**
 * Parse date string to avoid timezone issues
 */
export function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Check if date is in the past
 */
export function isPastDate(dateStr) {
  const date = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}
