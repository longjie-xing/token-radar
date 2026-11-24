// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every pre-token protocol the snapshot carries that the watchlist's own rule
// keeps: not an exchange, not a bridge, not liquid staking or restaking, not a versioned pool,
// not a wrapped or staked product of a token that already trades (198 rows here). The 40
// watchlist slugs are the floor, never the ceiling, and the 158 pre-token protocols below the
// watchlist floor are the early rows the radar exists to find. Live-token protocols are kept
// apart and shown with the market's own values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, in three factors:
//
//   multiple   = the category's benchmark: the median market-cap-to-TVL ratio of the live-token
//                protocols in the same category (at least 3 of them), else the global median across
//                all live-token protocols; clamped to [0.05, 1.00]. A category whose tokens already
//                trade at a high multiple of TVL is the market's own benchmark for what a launch in
//                that category is worth, and it is computed from this snapshot, never hard-coded.
//   growth     = clamp(change_7d, -50, 100) per cent
//   growthMult = 1 + (growth / 100) x 0.6
//   maturity   = 0.7 + min(age_days, 1095) / 1095 x 0.5   (age_days unknown: 365)
//   breadth    = 1 + min(chains - 1, 8) x 0.015: a launch rewards the users on every chain the
//                protocol runs on, so a protocol live on more chains reaches more farmers with the
//                same TVL; capped at 1.12x, and a single-chain protocol earns no breadth at all.
//   implied    = max(1, round(tvl_usd x multiple x growthMult x maturity x breadth))
//
// Age is the time since DefiLlama first listed the protocol: the best record of how long it has run
// with no token. A protocol that has held billions of TVL for years without issuing a token has a
// longer runway of unrewarded usage than one listed last month, so maturity lifts its value; a
// protocol shrinking fast is worth less than its TVL alone suggests. Breadth counts the chains the
// protocol runs on: a launch is a distribution event, and a protocol on eight chains reaches eight
// user bases where a single-chain one reaches one. No protocol name is ever
// special-cased: the same function scores every row, and the dashboard recomputes every row from the
// same figures so the page and the board can never disagree.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  min_category_n: number;
  breadth_per_chain: number;
  breadth_cap_chains: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.5,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  min_category_n: 3,
  breadth_per_chain: 0.015,
  breadth_cap_chains: 8,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's benchmark: the median market-cap-to-TVL ratio of its live tokens. */
export interface CategoryBenchmark {
  category: string;
  live_count: number;
  multiple: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  benchmarks: CategoryBenchmark[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted-by-value copy; null when the list is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * The category benchmarks, derived from the snapshot's live-token protocols alone: for each
 * category with at least `min_category_n` live protocols carrying a market cap, the median of
 * market-cap-over-TVL; plus the global median over every live protocol, the fallback for thin
 * categories. Each multiple is clamped into [multiple_floor, multiple_cap].
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, number>; global: number; benchmarks: CategoryBenchmark[] } {
  const perCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p)) continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const list = perCategory.get(key) ?? [];
    list.push(ratio);
    perCategory.set(key, list);
  }
  const globalRaw = median(all) ?? model.multiple_floor;
  // Rounded to 4 decimals here, so the dashboard (which reads the rounded benchmarks from
  // data.js) recomputes exactly the implied value the board carries — never a near miss.
  const global = round4(Math.min(model.multiple_cap, Math.max(model.multiple_floor, globalRaw)));
  const byCategory = new Map<string, number>();
  const benchmarks: CategoryBenchmark[] = [];
  for (const [category, ratios] of [...perCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (ratios.length < model.min_category_n) continue;
    const m = median(ratios);
    if (m === null) continue;
    const clamped = round4(Math.min(model.multiple_cap, Math.max(model.multiple_floor, m)));
    byCategory.set(category, clamped);
    benchmarks.push({ category, live_count: ratios.length, multiple: round4(clamped) });
  }
  benchmarks.sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  return { byCategory, global, benchmarks };
}

/** The multiple one protocol's category earns, or the global median when its category is thin. */
export function multipleFor(p: SnapshotProtocol, multiples: { byCategory: Map<string, number>; global: number }): number {
  return multiples.byCategory.get(p.category ?? 'Other') ?? multiples.global;
}

/** The breadth multiplier: 1 for a single-chain protocol, up to 1.12x for nine chains or more. */
export function breadthMultiplier(chains: string[], model: ModelConstants): number {
  const extra = Math.min(Math.max(chains.length - 1, 0), model.breadth_cap_chains);
  return round4(1 + extra * model.breadth_per_chain);
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiples: { byCategory: Map<string, number>; global: number },
): { implied: number; multiple: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = multipleFor(protocol, multiples);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = breadthMultiplier(protocol.chains, model);
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, multiple, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The categories the watchlist's own rule keeps out: a wrapped, staked or bridged product of a
 * token that already trades is not a token that does not exist yet, so it is never a launch
 * candidate, however large its TVL. WBTC is Bitcoin on Ethereum, a bridge is a token's road, not a
 * protocol waiting on a launch of its own.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name that begins with an exchange's name is that exchange's product, not a launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** A name carrying a whole word wrapped, staked or staking is a product of a token that trades. */
const WRAPPED_OR_STAKED = /\bwrapped\b|\bstaked\b|\bstaking\b/i;

/**
 * Whether a protocol is one the board may rank: pre-token, and none of the watchlist rule's
 * exclusions — not a bridge, not liquid staking or restaking, not an exchange, not a versioned
 * pool, not a wrapped or staked product, not an exchange's own product. The watchlist is the
 * floor of this same rule at $50M of TVL; the early radar applies it at every size.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name) &&
    !WRAPPED_OR_STAKED.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const multiples = categoryMultiples(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, in full.
  for (const slug of snapshot.watchlist) {
    const p = bySlug(snapshot.protocols).get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, not just the largest few. A small
  // protocol growing fast can outrank a large stagnant one once the model, not TVL, decides.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const { implied, multiple, growthPct, growthMult, maturityMult, breadthMult, age } = impliedValue(p, snapshot.as_of, model, multiples);
    return { p, implied, multiple, growthPct, growthMult, maturityMult, breadthMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: watchlist.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: round4(s.multiple),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A second chain when the protocol runs on more than one, else null. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open, so the protocol records a lender, not a visitor.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds in its app instead of bridging straight back.`;
  if (c.includes('liquid staking') || c.includes('restak') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge, then close it in profit or at a small planned loss.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one market position on an outcome you have actually researched.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares, so the vault records you as a depositor.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it instead of swapping it away.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it so the position accrues on-chain.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full cover period.`;
  if (c.includes('payment')) return `Route $${capital} of real payments through ${name} on ${chain} over two weeks instead of one lump transfer.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index on ${chain} and hold it through a rebalance.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position open for a full funding cycle.`;
  if (c.includes('anchor') || c.includes('btc')) return `Deposit $${capital} of BTC-backed value through ${name} on ${chain} and keep the position open.`;
  if (c.includes('chain') && !c.includes('cross chain')) return `Bridge $${capital} of USDC to ${name} on ${chain} and use its native apps: one swap on its main DEX and one transaction a week, so the wallet is an active user of the chain itself.`;
  if (c.includes('otc')) return `Open a $${capital} OTC quote on ${name} and settle one real trade through it, so the wallet is a maker, not a quote request.`;
  if (c.includes('cedefi')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the position through one full yield cycle.`;
  if (c.includes('farm')) return `Deposit $${capital} into ${name}'s main farm pool on ${chain} and compound the rewards once instead of claiming them.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into a ${name} managed liquidity vault on ${chain} and keep the position through one rebalance.`;
  if (c.includes('governance')) return `Deposit $${capital} through ${name} on ${chain} and vote on one live proposal, so the wallet is a participant, not a deposit.`;
  if (c.includes('card')) return `Load $${capital} onto ${name}'s card on ${chain} and spend it on two real purchases in the month, so the wallet shows card use, not a top-up.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and use its main feature once, so the wallet is an active user, not a deposit.`;
}

/** The complementary second action: a different feature of the same protocol, or its second chain. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string, second: string | null): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (second !== null) return `Repeat the same position with $${Math.round(capital / 2)} on ${second} through ${name}, so the wallet is active on two of its chains.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${Math.round(capital / 2)} of USDC against the supply on ${name}, then repay it within the week, so the wallet records both sides of the market.`;
  if (c.includes('dex') || c.includes('yield')) return `Swap $${Math.round(capital / 2)} through ${name}'s own router on ${chain} instead of an aggregator, so the volume is counted on the protocol itself.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Place a second small trade in the opposite direction on ${name} and close both, so the wallet shows more than one filled order.`;
  if (c.includes('bridge')) return `Bridge a second, smaller amount back through ${name} a week later instead of all at once, so the wallet shows repeated use.`;
  if (c.includes('prediction')) return `Settle one market on ${name} and place a second position on a different outcome, so the wallet is not a one-bet account.`;
  return `Use one more of ${name}'s features on ${chain} with $${Math.round(capital / 2)} — a swap, a vote or a second deposit — so the wallet is not a single-action account.`;
}

/** The weekly action: a different move of the same kind, so the wallet is a repeat user. */
function weeklyActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Each week, repay a small part of the borrow and re-supply it on ${name}, so the wallet shows steady use of both sides of the market.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Each week, add a little to a second pool on ${name} or swap a small amount through its own router, so the volume is counted on the protocol itself.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Each week, close one position on ${name} and open a fresh one, so the wallet shows more than one filled order a month.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Each week, bridge a small amount through ${name} instead of one lump transfer, so the wallet shows repeated use.`;
  if (c.includes('prediction')) return `Each week, settle one market on ${name} and place a position on a new one, so the wallet is not a one-bet account.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Each week, top up the ${name} vault by a little or move part of it to a second vault, so the deposit is not a single event.`;
  if (c.includes('stable') || c.includes('rwa') || c.includes('basis')) return `Each week, mint or deposit a small amount more through ${name} and keep it, so the balance grows instead of sitting still.`;
  if (c.includes('liquid staking') || c.includes('restak') || c.includes('staking pool')) return `Each week, stake a small amount more through ${name} and keep the receipt token, so the stake grows week by week.`;
  if (c.includes('chain') && !c.includes('cross chain')) return `Each week, make one real transaction on ${name} — a swap, a transfer or a contract call — so the wallet is a weekly user of the chain.`;
  if (c.includes('payment') || c.includes('card')) return `Each week, route one real payment through ${name} instead of batching everything into one transfer.`;
  if (c.includes('governance')) return `Each week, read the live proposals on ${name} and vote on one, so the wallet is a participant every week.`;
  return `Each week, make one qualifying action on ${name} — a deposit, a borrow, a swap or a vote — and never let the wallet sit untouched for a whole month.`;
}

/** The exit: how to leave, by category, so one failed transaction never strands the position. */
function exitActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Repay the borrow on ${name} first, then withdraw the supply in two parts, so no debt is left behind when the position closes.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Remove the liquidity from ${name} in two parts, starting with the smaller pool, and check the slippage on each withdrawal.`;
  if (c.includes('liquid staking') || c.includes('restak') || c.includes('staking pool')) return `Unstake from ${name} in two parts and wait out the unbonding period on each, so the exit is never rushed into one block.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Close every open position on ${name} before withdrawing the margin, and withdraw the margin in two parts.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge the funds back through ${name} in two parts on different days, so one stuck bridge never strands the whole position.`;
  if (c.includes('stable') || c.includes('rwa') || c.includes('basis')) return `Redeem the ${name} asset in two parts and confirm each redemption landed before redeeming the rest.`;
  return `Unstake or withdraw from ${name} in two parts so one failed transaction never strands the whole position.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const secondAction = secondActionFor(p, capital, chain, second);
  const weekly = weeklyActionFor(p, capital, chain);
  const holdText =
    second !== null
      ? `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and keep the ${second} position open too, so both chains stay active. Do not withdraw everything the moment a points page appears.`
      : `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw everything the moment a points page appears.`;
  const exit = exitActionFor(p, capital, chain);
  return [
    {
      text: `Set up a fresh wallet that holds only the funds you plan to farm, keep its seed phrase offline, and open ${p.name} only from the link its own docs or verified social account publishes.`,
      cost: 'under $3 of gas for the first transaction',
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondAction,
      cost: `about $${capital >= 150 ? 6 : 3} of gas`,
      time: '10 minutes',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: holdText,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you claim anything, open ${p.name}'s own points or rewards page from its official link and claim only there; a token that asks you to pay to claim it is a scam.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, then plan the exit: ${exit}`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    watchlist: row.watchlist,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const multiples = categoryMultiples(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round4(multiples.global),
    benchmarks: multiples.benchmarks,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
