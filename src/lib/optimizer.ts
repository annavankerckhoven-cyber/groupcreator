// Group optimization algorithm.
// Scoring: +1 per liked teammate (per perspective), -20 per disliked teammate (per perspective).
// Edges are directed: an edge {a, b, kind:'with'} means "a wants to be with b" (only a gains +1).
// Mutual likes/dislikes count twice naturally because there will be two directed edges.

export type Kind = "with" | "avoid";
export interface Edge {
  a: string;
  b: string;
  kind: Kind;
}
export type Distribution = string[][];
export interface TopResult {
  score: number;
  groups: Distribution;
}

export interface OptimizerInput {
  studentIds: string[];
  groupSize: number;
  sizePolicy: "plus" | "minus";
  edges: Edge[];
  timeLimitMs: number;
}

export interface ProgressMsg {
  elapsedMs: number;
  iterations: number;
  bestScore: number;
}
export type ProgressFn = (m: ProgressMsg) => void;

/** Plan group sizes from N students, target size S, and policy. */
export function computeGroupSizes(n: number, size: number, policy: "plus" | "minus"): number[] {
  if (n <= 0) return [];
  if (size <= 1) return Array.from({ length: n }, () => 1);
  if (n <= size) return [n];

  const balancedSizes = (groups: number) => {
    const count = Math.max(1, Math.min(n, groups));
    const base = Math.floor(n / count);
    const extra = n - base * count;
    return [...Array(extra).fill(base + 1), ...Array(count - extra).fill(base)];
  };

  if (policy === "plus") {
    let g = Math.floor(n / size);
    while (n > g * (size + 1)) g++;

    // Some combinations cannot be represented using only size/size+1 groups
    // (for example 8 students with a target group size of 6). Fall back to the
    // closest balanced distribution instead of crashing the optimizer.
    if (n < g * size) return balancedSizes(g);

    const rem = n - g * size;
    // `rem` groups of size+1, the rest of size
    return [...Array(rem).fill(size + 1), ...Array(g - rem).fill(size)];
  }
  // policy === "minus"
  const g = Math.ceil(n / size);
  const shortage = g * size - n;
  if (shortage > g) {
    // Can't achieve with only size/size-1 groups; use the closest balanced split.
    return balancedSizes(g);
  }
  return [...Array(shortage).fill(size - 1), ...Array(g - shortage).fill(size)];
}

interface Adj {
  likes: number[][]; // likes[i] = ids that i wants to be with
  dislikes: number[][]; // dislikes[i] = ids that i wants to avoid
  likedBy: number[][]; // likedBy[i] = ids that want to be with i
  dislikedBy: number[][]; // dislikedBy[i] = ids that want to avoid i
}

function buildAdj(ids: string[], edges: Edge[]): Adj {
  const idx = new Map(ids.map((id, i) => [id, i] as const));
  const N = ids.length;
  const likes: number[][] = Array.from({ length: N }, () => []);
  const dislikes: number[][] = Array.from({ length: N }, () => []);
  const likedBy: number[][] = Array.from({ length: N }, () => []);
  const dislikedBy: number[][] = Array.from({ length: N }, () => []);
  for (const e of edges) {
    const a = idx.get(e.a);
    const b = idx.get(e.b);
    if (a == null || b == null || a === b) continue;
    if (e.kind === "with") {
      likes[a].push(b);
      likedBy[b].push(a);
    } else {
      dislikes[a].push(b);
      dislikedBy[b].push(a);
    }
  }
  const dedupe = (arr: number[][]) => arr.map((row) => Array.from(new Set(row)));
  return {
    likes: dedupe(likes),
    dislikes: dedupe(dislikes),
    likedBy: dedupe(likedBy),
    dislikedBy: dedupe(dislikedBy),
  };
}

function scoreGroup(group: number[], adj: Adj): number {
  const set = new Set(group);
  let s = 0;
  for (const m of group) {
    for (const x of adj.likes[m]) if (set.has(x)) s += 1;
    for (const x of adj.dislikes[m]) if (set.has(x)) s -= 20;
  }
  return s;
}

function scoreDistribution(dist: number[][], adj: Adj): number {
  let s = 0;
  for (const g of dist) s += scoreGroup(g, adj);
  return s;
}

/** Change in total score from adding student `s` to a group whose current members are in `set`. */
function deltaScore(s: number, set: Set<number>, adj: Adj): number {
  let d = 0;
  for (const x of adj.likes[s]) if (set.has(x)) d += 1; // s's own gain
  for (const x of adj.dislikes[s]) if (set.has(x)) d -= 20; // s's own loss
  for (const x of adj.likedBy[s]) if (set.has(x)) d += 1; // existing members gain
  for (const x of adj.dislikedBy[s]) if (set.has(x)) d -= 20; // existing members lose
  return d;
}

function probTable(numGroups: number): number[] {
  if (numGroups <= 1) return [1];
  if (numGroups === 2) return [0.8, 0.2];
  if (numGroups === 3) return [0.7, 0.2, 0.1];
  const arr = [0.7, 0.2, 0.1];
  for (let i = 3; i < numGroups; i++) arr.push(0);
  return arr;
}

function pickByProb(probs: number[], rand: () => number): number {
  const r = rand();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return probs.length - 1;
}

function shuffle<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Greedy placement of `students` into fresh groups with the given target sizes. */
function greedyPlace(
  students: number[],
  sizes: number[],
  adj: Adj,
  rand: () => number,
): number[][] {
  const groups: number[][] = sizes.map(() => []);
  const sets: Set<number>[] = sizes.map(() => new Set());
  const probs = probTable(sizes.length);
  for (const s of students) {
    const cands: { idx: number; d: number }[] = [];
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].length < sizes[i]) cands.push({ idx: i, d: deltaScore(s, sets[i], adj) });
    }
    if (cands.length === 0) continue;
    cands.sort((x, y) => y.d - x.d);
    const rank = Math.min(pickByProb(probs, rand), cands.length - 1);
    const pick = cands[rank];
    groups[pick.idx].push(s);
    sets[pick.idx].add(s);
  }
  return groups;
}

function randomPlace(students: number[], sizes: number[], rand: () => number): number[][] {
  const list = students.slice();
  shuffle(list, rand);
  const groups: number[][] = sizes.map(() => []);
  let k = 0;
  for (let i = 0; i < sizes.length; i++) {
    for (let j = 0; j < sizes[i] && k < list.length; j++, k++) groups[i].push(list[k]);
  }
  return groups;
}

/** Canonical key — order of groups and students within each group is irrelevant. */
function canonical(dist: number[][]): string {
  return dist
    .map((g) =>
      g
        .slice()
        .sort((a, b) => a - b)
        .join(","),
    )
    .sort()
    .join("|");
}

/** Mutate: rebuild the worst third of the parent's groups. */
function mutate(parent: number[][], sizes: number[], adj: Adj, rand: () => number): number[][] {
  const scored = parent.map((g, i) => ({ i, s: scoreGroup(g, adj) }));
  scored.sort((a, b) => a.s - b.s);
  const numWorst = Math.max(2, Math.round(parent.length / 3));
  const worstIndices = scored.slice(0, Math.min(numWorst, parent.length)).map((x) => x.i);
  const worstSet = new Set(worstIndices);
  const removed: number[] = [];
  const next: number[][] = parent.map((g, i) =>
    worstSet.has(i) ? (removed.push(...g), []) : g.slice(),
  );
  shuffle(removed, rand);
  const worstSizes = worstIndices.map((i) => sizes[i]);
  const rebuilt = greedyPlace(removed, worstSizes, adj, rand);
  worstIndices.forEach((origIdx, k) => {
    next[origIdx] = rebuilt[k];
  });
  return next;
}

export function runOptimizer(input: OptimizerInput, onProgress?: ProgressFn): TopResult[] {
  const { studentIds, groupSize, sizePolicy, edges, timeLimitMs } = input;
  if (studentIds.length === 0) return [];
  const sizes = computeGroupSizes(studentIds.length, groupSize, sizePolicy);
  const N = studentIds.length;
  const adj = buildAdj(studentIds, edges);
  const all = Array.from({ length: N }, (_, i) => i);

  // importance = own dislikes + dislikes received
  const importance = all.map((i) => adj.dislikes[i].length + adj.dislikedBy[i].length);

  const rand = Math.random;

  function importanceOrder(): number[] {
    const buckets = new Map<number, number[]>();
    for (const i of all) {
      const k = importance[i];
      const arr = buckets.get(k);
      if (arr) arr.push(i);
      else buckets.set(k, [i]);
    }
    const keys = Array.from(buckets.keys()).sort((a, b) => b - a);
    const out: number[] = [];
    for (const k of keys) {
      const g = buckets.get(k)!;
      shuffle(g, rand);
      out.push(...g);
    }
    return out;
  }

  const makeImportance = () => greedyPlace(importanceOrder(), sizes, adj, rand);
  const makeRandomGreedy = () => {
    const s = all.slice();
    shuffle(s, rand);
    return greedyPlace(s, sizes, adj, rand);
  };
  const makeRandom = () => randomPlace(all, sizes, rand);

  let pop: number[][][] = [];
  for (let i = 0; i < 100; i++) pop.push(makeImportance());
  for (let i = 0; i < 100; i++) pop.push(makeRandomGreedy());
  for (let i = 0; i < 50; i++) pop.push(makeRandom());

  const start = Date.now();
  let iter = 0;
  let lastReport = start;
  let bestScore = -Infinity;

  while (Date.now() - start < timeLimitMs) {
    iter++;
    const scored = pop.map((d) => ({ d, s: scoreDistribution(d, adj) }));
    scored.sort((a, b) => b.s - a.s);
    bestScore = scored[0]?.s ?? -Infinity;

    const survivors = scored.slice(0, 50).map((x) => x.d);
    const children = survivors.map((p) => mutate(p, sizes, adj, rand));

    const combined = [...survivors, ...children];
    
    // Add new importance-based and random greedy distributions before deduplication
    for (let i = 0; i < 20; i++) combined.push(makeImportance());
    for (let i = 0; i < 100; i++) combined.push(makeRandomGreedy());

    // Remove duplicates after adding new distributions
    const seen = new Set<string>();
    const unique: number[][][] = [];
    for (const d of combined) {
      const k = canonical(d);
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(d);
      }
    }

    const next: number[][][] = unique.slice();
    while (next.length < 250) next.push(makeRandom());
    pop = next.slice(0, 250);

    const now = Date.now();
    if (onProgress && now - lastReport > 250) {
      lastReport = now;
      onProgress({ elapsedMs: now - start, iterations: iter, bestScore });
    }
  }

  const scoredFinal = pop.map((d) => ({ d, s: scoreDistribution(d, adj) }));
  scoredFinal.sort((a, b) => b.s - a.s);
  const seen = new Set<string>();
  const top: TopResult[] = [];
  for (const { d, s } of scoredFinal) {
    const k = canonical(d);
    if (seen.has(k)) continue;
    seen.add(k);
    top.push({ score: s, groups: d.map((g) => g.map((i) => studentIds[i])) });
    if (top.length === 5) break;
  }
  return top;
}
