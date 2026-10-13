/* Weekly sets against a minimum: one rule for the judgement and the
   number shown beside it, used by the plan builder and the month report.
   An area is short under its minimum by more than a rounding hair; a
   short area's number rounds down, so «6 من 6» never sits on an area
   flagged short (5.7 reads 5). Anything else rounds as usual. Small, so
   the main bundle can use it without the builder's engine. */

export const isShort = (cur, min) => cur < min - 0.05

export const setsShown = (cur, min) => {
  const x = Number(cur) || 0
  return min != null && isShort(x, min) ? Math.floor(x + 0.001) : Math.round(x)
}
