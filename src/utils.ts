function daysAgo(date: Date): number {
  return Date.now() - date.getTime() / (1000 * 60 * 60 * 24)
}
