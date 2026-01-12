import { CrudInterface, Table, OmitId, DataTypes } from "brackets-manager";
import { db } from "../config/database";
import {
  stages,
  groups,
  rounds,
  matches,
  matchGames,
  teams,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { matchParticipantRepository, ParticipantRole } from "../repository/match-participant.repository";

const tableMap: Record<Table, any> = {
  stage: stages,
  group: groups,
  round: rounds,
  match: matches,
  match_game: matchGames,
  participant: teams, // Mapping "participant" table of lib to "teams"
};

export class BracketsStorage implements CrudInterface {
  async insert<T extends Table>(
    table: T,
    value: OmitId<DataTypes[T]> | OmitId<DataTypes[T]>[]
  ): Promise<any> {
    const dbTable = tableMap[table];
    if (!dbTable) throw new Error(`Unknown table: ${table}`);

    const values = Array.isArray(value) ? value : [value];

    // Special handling for participants (teams)
    if (table === 'participant') {
      const results = [];
      for (const v of values) {
        const mapped = this.mapToDrizzle(table, v);
        if (mapped.name && mapped.tournamentId) {
          const existing = await db.query.teams.findFirst({
            where: and(
              eq(teams.name, mapped.name),
              eq(teams.tournamentId, mapped.tournamentId)
            )
          });

          if (existing) {
            results.push({ id: existing.id });
          } else {
            const inserted = await db.insert(dbTable).values(mapped).returning({ id: dbTable.id });
            results.push(inserted[0]);
          }
        } else {
          const inserted = await db.insert(dbTable).values(mapped).returning({ id: dbTable.id });
          results.push(inserted[0]);
        }
      }
      return Array.isArray(value) ? true : results[0].id;
    }

    // Special handling for matches
    if (table === 'match') {
      const valuesToInsert = [];
      // Helper to keep track of pending participants for each row
      const pendingParticipantsMap = new Map<number, any[]>();

      const matchValues = values as any[];

      // Fetch tournamentId from stage
      const stageIds = new Set(matchValues.map(v => v.stage_id).filter(id => id !== undefined));
      const stageMap = new Map<string | number, string>();

      if (stageIds.size > 0) {
        const stagesData = await db.select({ id: stages.id, tournamentId: stages.tournamentId })
          .from(stages)
          .where(inArray(stages.id, Array.from(stageIds) as string[]));
        stagesData.forEach(s => stageMap.set(s.id, s.tournamentId));
      }

      for (let i = 0; i < matchValues.length; i++) {
        const v = matchValues[i];
        const mapped = this.mapToDrizzle(table, v);

        // Handle pending participants logic from mapToDrizzle
        // _pendingParticipants was attached to mapped object
        if (mapped._pendingParticipants) {
          pendingParticipantsMap.set(i, mapped._pendingParticipants);
          delete mapped._pendingParticipants;
        }

        if ('status' in mapped) {
          mapped.bracketStatus = mapped.status;
          delete mapped.status;
        }

        if (mapped.stageId && stageMap.has(mapped.stageId)) {
          mapped.tournamentId = stageMap.get(mapped.stageId);
        }

        valuesToInsert.push(mapped);
      }

      const insertedRows = await db.insert(dbTable).values(valuesToInsert).returning({ id: dbTable.id });

      // Create participants for inserted matches
      for (let i = 0; i < insertedRows.length; i++) {
        const matchId = insertedRows[i].id;
        const pending = pendingParticipantsMap.get(i);
        if (pending) {
          for (const p of pending) {
            await matchParticipantRepository.create({
              matchId,
              ...p
            });
          }
          // Sync back columns for safety
          await this.syncOpponentsColumns(matchId);
        }
      }

      return Array.isArray(value) ? true : insertedRows[0].id;
    }

    // Default insert for other tables
    const mappedValues = values.map(v => this.mapToDrizzle(table, v));
    const insertedRows = await db.insert(dbTable).values(mappedValues).returning({ id: dbTable.id });

    return Array.isArray(value) ? true : insertedRows[0].id;
  }

  async select<T extends Table>(
    table: T,
    idOrFilter?: number | string | Partial<DataTypes[T]>
  ): Promise<DataTypes[T] | DataTypes[T][] | null> {
    const dbTable = tableMap[table];
    if (!dbTable) throw new Error(`Unknown table: ${table}`);

    if (idOrFilter === undefined) {
      const rows = await db.select().from(dbTable);
      return Promise.all(rows.map(r => this.mapFromDrizzle(table, r))) as Promise<DataTypes[T][]>;
    }

    if (typeof idOrFilter === "number" || typeof idOrFilter === "string") {
      const rows = await db.select().from(dbTable).where(eq(dbTable.id, idOrFilter));
      return rows.length > 0 ? await this.mapFromDrizzle(table, rows[0]) as DataTypes[T] : null;
    }

    const filter = idOrFilter as Partial<DataTypes[T]>;
    const conditions = [];

    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined) continue;
      const drizzleKey = this.toCamelCase(key);
      // @ts-ignore
      if (dbTable[drizzleKey]) {
        // @ts-ignore
        conditions.push(eq(dbTable[drizzleKey], value));
      }
    }

    let rows;
    if (conditions.length === 0) {
      rows = await db.select().from(dbTable);
    } else {
      rows = await db.select().from(dbTable).where(and(...conditions));
    }

    return Promise.all(rows.map(r => this.mapFromDrizzle(table, r))) as Promise<DataTypes[T][]>;
  }

  async update<T extends Table>(
    table: T,
    idOrFilter: number | string | Partial<DataTypes[T]>,
    value: DataTypes[T] | Partial<DataTypes[T]>
  ): Promise<boolean> {
    const dbTable = tableMap[table];
    if (!dbTable) throw new Error(`Unknown table: ${table}`);

    const mappedValue = this.mapToDrizzle(table, value);
    let pendingParticipants: any[] | undefined;

    if (mappedValue._pendingParticipants) {
      pendingParticipants = mappedValue._pendingParticipants;
      delete mappedValue._pendingParticipants;
    }

    if ('status' in mappedValue) {
      mappedValue.bracketStatus = mappedValue.status;
      delete mappedValue.status;
    }

    // Perform DB update
    let targetIds: string[] = [];

    if (typeof idOrFilter === "number" || typeof idOrFilter === "string") {
      await db.update(dbTable).set(mappedValue).where(eq(dbTable.id, idOrFilter));
      targetIds.push(String(idOrFilter));
    } else {
      const filter = idOrFilter as Partial<DataTypes[T]>;
      const conditions = [];
      for (const [key, val] of Object.entries(filter)) {
        if (val === undefined) continue;
        const drizzleKey = this.toCamelCase(key);
        // @ts-ignore
        if (dbTable[drizzleKey]) {
          // @ts-ignore
          conditions.push(eq(dbTable[drizzleKey], val));
        }
      }
      if (conditions.length > 0) {
        const updated = await db.update(dbTable).set(mappedValue).where(and(...conditions)).returning({ id: dbTable.id });
        targetIds = updated.map(u => u.id);
      }
    }

    // Sync participants if needed
    if (table === 'match' && pendingParticipants && targetIds.length > 0) {
      for (const matchId of targetIds) {
        // For update, we might need to update existing participants or insert if missing.
        // Strategy: clear and recreate? Or smart update?
        // Clearing deletes history/scores if unrelated update happens? 
        // But BracketsManager usually sends complete state for opponents.
        // Safer: delete existing match_participants for this match and recreate from pending.
        // Note: this resets manually entered scores if any, but BracketsManager rules usually.

        await matchParticipantRepository.deleteByMatchId(matchId);

        for (const p of pendingParticipants) {
          await matchParticipantRepository.create({
            matchId,
            ...p
          });
        }
        await this.syncOpponentsColumns(matchId);
      }
    }

    return targetIds.length > 0;
  }

  async delete<T extends Table>(
    table: T,
    idOrFilter?: number | string | Partial<DataTypes[T]>
  ): Promise<boolean> {
    const dbTable = tableMap[table];
    if (!dbTable) throw new Error(`Unknown table: ${table}`);

    if (idOrFilter === undefined) {
      await db.delete(dbTable);
      return true;
    }

    if (typeof idOrFilter === "number" || typeof idOrFilter === "string") {
      await db.delete(dbTable).where(eq(dbTable.id, idOrFilter));
      return true;
    }

    const filter = idOrFilter as Partial<DataTypes[T]>;
    const conditions = [];
    for (const [key, val] of Object.entries(filter)) {
      if (val === undefined) continue;
      const drizzleKey = this.toCamelCase(key);
      // @ts-ignore
      if (dbTable[drizzleKey]) {
        // @ts-ignore
        conditions.push(eq(dbTable[drizzleKey], val));
      }
    }

    if (conditions.length > 0) {
      await db.delete(dbTable).where(and(...conditions));
      return true;
    }

    return false;
  }

  private mapToDrizzle(table: Table, value: any): any {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      const newKey = this.toCamelCase(key);
      result[newKey] = val;
    }

    // Convert opponent1/opponent2 to pending participants for matches
    if (table === 'match') {
      if (value.opponent1 !== undefined || value.opponent2 !== undefined) {
        result._pendingParticipants = [];

        // Opponent 1 -> SEED_1 (or HOME/AWAY depending on context, using SEED for brackets)
        if (value.opponent1) {
          result._pendingParticipants.push({
            role: ParticipantRole.SEED_1,
            position: 1,
            teamId: value.opponent1.id,
            score: value.opponent1.score,
            isWinner: value.opponent1.result === 'win'
          });
        } else {
          // Even if null, brackets manager might imply "empty slot".
          // Do we create empty participant? Or just skip?
          // BracketsManager uses null for empty.
          // We can skip creating row, or create placeholder?
          // Let's skip.
        }

        if (value.opponent2) {
          result._pendingParticipants.push({
            role: ParticipantRole.SEED_2,
            position: 2,
            teamId: value.opponent2.id,
            score: value.opponent2.score,
            isWinner: value.opponent2.result === 'win'
          });
        }
      }

      // Keep opponent1/opponent2 columns for now? 
      // Implementation plan said: "Garder opponent1/opponent2 en DB pour compatibilité lib (lecture seule)".
      // So we should let them be written too if brackets manager sends them.
      // result.opponent1 = value.opponent1; ... handled by loop via camelCase?
      // opponent1 is in 'value'. Loop converts keys to camelCase.
      // opponent1 -> opponent1.
      // So it is already in result.
    }

    Object.keys(result).forEach(key => result[key] === undefined && delete result[key]);
    return result;
  }

  private async mapFromDrizzle(table: Table, value: any): Promise<any> {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      const newKey = this.toSnakeCase(key);
      result[newKey] = val;
    }

    if (table === 'match') {
      if (value.bracketStatus !== undefined) {
        result.status = value.bracketStatus;
      }

      // Populate opponent1/opponent2 from match_participants
      const participants = await matchParticipantRepository.getByMatchId(value.id);

      // Find by position or role
      const p1 = participants.find(p => p.position === 1 || p.role === ParticipantRole.SEED_1 || p.role === ParticipantRole.HOME);
      const p2 = participants.find(p => p.position === 2 || p.role === ParticipantRole.SEED_2 || p.role === ParticipantRole.AWAY);

      result.opponent1 = p1 ? {
        id: p1.teamId ?? null, // Brackets manager expects ID (usually team ID)
        position: p1.position,
        score: p1.score,
        result: p1.isWinner ? 'win' : (p1.score != null && p2?.score != null && p1.score < p2.score ? 'loss' : undefined)
      } : null;

      result.opponent2 = p2 ? {
        id: p2.teamId ?? null,
        position: p2.position,
        score: p2.score,
        result: p2.isWinner ? 'win' : (p2.score != null && p1?.score != null && p2.score < p1.score ? 'loss' : undefined)
      } : null;

      // If participants not found (e.g. empty match), keep null.
    }

    return result;
  }

  // Helper to sync columns for safety (avoid divergence)
  private async syncOpponentsColumns(matchId: string) {
    // logic similar to mapFromDrizzle but update DB
    // Actually BracketsManager writes to these columns.
    // We only need to ensure they stay in sync if we modified participants via other means?
    // But here we just wrote to participants based on these columns (from input).
    // So they are sync.
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
