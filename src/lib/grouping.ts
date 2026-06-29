// Pure deterministic grouping algorithm. No DB calls.

export type EdgeKind = "with" | "avoid";
export interface Edge { a: string; b: string; kind: EdgeKind }
export type SizePolicy = "flex" | "strict";

export interface GroupingInput {
  studentIds: string[];          // present students only
  groupSize: number;             // target N
  sizePolicy: SizePolicy;
  edges: Edge[];                 // both directions counted (undirected)
}

export interface GroupingResult {
  groups: string[][];            // arrays of student ids
  unsatisfiedWith: number;       // number of 'with' edges not satisfied (within-group)
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildEdgeSets(edges: Edge[]) {
  const withMap = new Map<string, Set<string>>();
  const avoidMap = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, x: string, y: string) => {
    if (!m.has(x)) m.set(x, new Set());
    m.get(x)!.add(y);
  };
  for (const e of edges) {
    const m = e.kind === "with" ? withMap : avoidMap;
    add(m, e.a, e.b);
    add(m, e.b, e.a);
  }
  return { withMap, avoidMap };
}

/**
 * Hard avoid, soft prefer.
 * 1. Union-find on 'with' edges, but skip merges that would unify two students
 *    who have an 'avoid' edge between them.
 * 2. Bin-pack clusters into groups of capacity N (or ±1 if flex).
 * 3. Never place two students in the same group if they have an avoid edge.
 */
export function generateGroups(input: GroupingInput): GroupingResult {
  const { studentIds, groupSize, sizePolicy, edges } = input;
  if (groupSize < 2) throw new Error("Group size must be at least 2");
  const { withMap, avoidMap } = buildEdgeSets(edges);

  // Union-find with avoid-aware merging
  const parent = new Map<string, string>();
  const members = new Map<string, Set<string>>(); // root -> members
  for (const id of studentIds) {
    parent.set(id, id);
    members.set(id, new Set([id]));
  }
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r)! !== r) r = parent.get(r)!;
    let cur = x;
    while (parent.get(cur)! !== r) {
      const nxt = parent.get(cur)!;
      parent.set(cur, r);
      cur = nxt;
    }
    return r;
  };
  const wouldCreateAvoid = (rootA: string, rootB: string) => {
    const mA = members.get(rootA)!;
    const mB = members.get(rootB)!;
    const [small, large] = mA.size < mB.size ? [mA, mB] : [mB, mA];
    for (const s of small) {
      const av = avoidMap.get(s);
      if (!av) continue;
      for (const t of large) if (av.has(t)) return true;
    }
    return false;
  };
  const union = (a: string, b: string) => {
    const rA = find(a);
    const rB = find(b);
    if (rA === rB) return;
    if (members.get(rA)!.size + members.get(rB)!.size > groupSize) return; // never cluster > capacity
    if (wouldCreateAvoid(rA, rB)) return;
    const mA = members.get(rA)!;
    const mB = members.get(rB)!;
    for (const s of mB) mA.add(s);
    members.delete(rB);
    parent.set(rB, rA);
  };
  for (const e of edges) {
    if (e.kind !== "with") continue;
    if (!parent.has(e.a) || !parent.has(e.b)) continue;
    union(e.a, e.b);
  }

  const clusters: string[][] = [];
  for (const m of members.values()) clusters.push(Array.from(m));
  clusters.sort((a, b) => b.length - a.length);

  const maxCap = sizePolicy === "strict" ? groupSize : groupSize + 1;

  const groups: string[][] = [];
  const groupAvoidIds: Set<string>[] = []; // students in each group

  const violatesAvoid = (g: string[], candidates: string[]) => {
    for (const m of g) {
      const av = avoidMap.get(m);
      if (!av) continue;
      for (const c of candidates) if (av.has(c)) return true;
    }
    return false;
  };
  const satisfiedWith = (g: string[], candidates: string[]) => {
    let n = 0;
    for (const m of g) {
      const w = withMap.get(m);
      if (!w) continue;
      for (const c of candidates) if (w.has(c)) n++;
    }
    return n;
  };

  for (const cluster of clusters) {
    // Find best existing group
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.length + cluster.length > maxCap) continue;
      if (violatesAvoid(g, cluster)) continue;
      const fit = satisfiedWith(g, cluster) * 10 + (maxCap - g.length - cluster.length); // prefer fuller fits
      if (fit > bestScore) {
        bestScore = fit;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      groups[bestIdx].push(...cluster);
      for (const s of cluster) groupAvoidIds[bestIdx].add(s);
    } else {
      groups.push([...cluster]);
      groupAvoidIds.push(new Set(cluster));
    }
  }

  // Balancing: if strict policy, try to move single students from oversize groups (shouldn't happen, but be defensive)
  // For flex policy, try to even out sizes when very lopsided
  if (sizePolicy === "flex" && groups.length > 1) {
    let changed = true;
    let safety = 50;
    while (changed && safety-- > 0) {
      changed = false;
      groups.sort((a, b) => b.length - a.length);
      const biggest = groups[0];
      const smallest = groups[groups.length - 1];
      if (biggest.length - smallest.length <= 1) break;
      // Try moving a student from biggest to smallest without creating avoid
      for (let i = 0; i < biggest.length; i++) {
        const s = biggest[i];
        if (violatesAvoid(smallest, [s])) continue;
        if (smallest.length + 1 > maxCap) break;
        smallest.push(s);
        biggest.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  // Count unsatisfied 'with' edges (within remaining roster)
  const roster = new Set(studentIds);
  const sameGroup = new Map<string, number>();
  groups.forEach((g, idx) => g.forEach((s) => sameGroup.set(s, idx)));
  let unsatisfied = 0;
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.kind !== "with") continue;
    if (!roster.has(e.a) || !roster.has(e.b)) continue;
    const k = pairKey(e.a, e.b);
    if (seen.has(k)) continue;
    seen.add(k);
    if (sameGroup.get(e.a) !== sameGroup.get(e.b)) unsatisfied++;
  }

  return { groups, unsatisfiedWith: unsatisfied };
}

/**
 * Insert a single student into the best existing group without reshuffling others.
 * - Picks group with no avoid conflicts, room (<= groupSize + (flex?1:0)), most 'with' edges to existing members, then smallest size.
 * - If no group fits, opens a new singleton group at the end.
 */
export function addStudentToBestGroup(
  groups: string[][],
  studentId: string,
  edges: Edge[],
  groupSize: number,
  sizePolicy: SizePolicy,
): { groups: string[][]; placedInIndex: number; createdNewGroup: boolean } {
  const { withMap, avoidMap } = buildEdgeSets(edges);
  const maxCap = sizePolicy === "strict" ? groupSize : groupSize + 1;
  const out = groups.map((g) => [...g]);

  let bestIdx = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < out.length; i++) {
    const g = out[i];
    if (g.length + 1 > maxCap) continue;
    const av = avoidMap.get(studentId);
    if (av && g.some((m) => av.has(m))) continue;
    const w = withMap.get(studentId);
    const withScore = w ? g.filter((m) => w.has(m)).length : 0;
    // higher 'with' wins, then smaller group wins
    const score = withScore * 100 + (maxCap - g.length);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    out[bestIdx].push(studentId);
    return { groups: out, placedInIndex: bestIdx, createdNewGroup: false };
  }
  out.push([studentId]);
  return { groups: out, placedInIndex: out.length - 1, createdNewGroup: true };
}