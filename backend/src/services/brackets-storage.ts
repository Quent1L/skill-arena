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

const tableMap: Record<Table, any> = {
  stage: stages,
  group: groups,
  round: rounds,
  match: matches,
  match_game: matchGames,
  participant: teams,
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
                // Try to find existing team
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

        if (Array.isArray(value)) {
            return true;
        } else {
            return results[0].id;
        }
    }

    // Special handling for matches
    if (table === 'match') {
        const valuesToInsert = [];
        const matchValues = values as any[]; // Cast to any to access specific properties like stage_id
        
        // We need to fetch tournamentId from stage for each match
        // Collect all unique stage IDs
        const stageIds = new Set(matchValues.map(v => v.stage_id).filter(id => id !== undefined));
        const stageMap = new Map<string | number, string>();
        
        console.log(`[BracketsStorage] Inserting matches. Stage IDs found in payload:`, Array.from(stageIds));

        if (stageIds.size > 0) {
            // Fetch stages to get tournamentId
            // Use inArray for correct filtering of multiple IDs
            const stagesData = await db.select({ id: stages.id, tournamentId: stages.tournamentId })
                .from(stages)
                .where(inArray(stages.id, Array.from(stageIds) as string[]));
            
            console.log(`[BracketsStorage] Fetched stages data:`, stagesData);
            stagesData.forEach(s => stageMap.set(s.id, s.tournamentId));
        }

        for (const v of matchValues) {
            const mapped = this.mapToDrizzle(table, v);
            
            // 1. Handle Status Conflict
            if ('status' in mapped) {
                mapped.bracketStatus = mapped.status;
                delete mapped.status; 
            }

            // 2. Inject Tournament ID
            if (mapped.stageId && stageMap.has(mapped.stageId)) {
                mapped.tournamentId = stageMap.get(mapped.stageId);
            } else {
                console.error(`[BracketsStorage] Missing tournamentId for match. stageId: ${mapped.stageId}, found in map: ${stageMap.has(mapped.stageId)}`);
            }

            valuesToInsert.push(mapped);
        }

        const insertedRows = await db.insert(dbTable).values(valuesToInsert).returning({ id: dbTable.id });
        
        console.log(`[BracketsStorage] Inserted ${insertedRows.length} matches.`);

        if (Array.isArray(value)) {
            return true;
        } else {
            return insertedRows[0].id;
        }
    }

    const mappedValues = values.map(v => this.mapToDrizzle(table, v));

    const insertedRows = await db.insert(dbTable).values(mappedValues).returning({ id: dbTable.id });

    if (Array.isArray(value)) {
      return true; 
    } else {
      // Return the UUID. The library types say 'number', but we hope it handles strings if we force it,
      // as the 'Id' type is 'string | number'.
      return insertedRows[0].id;
    }
  }

  async select<T extends Table>(
    table: T,
    idOrFilter?: number | string | Partial<DataTypes[T]>
  ): Promise<DataTypes[T] | DataTypes[T][] | null> {
    const dbTable = tableMap[table];
    if (!dbTable) throw new Error(`Unknown table: ${table}`);

    if (idOrFilter === undefined) {
      const rows = await db.select().from(dbTable);
      return rows.map(r => this.mapFromDrizzle(table, r)) as DataTypes[T][];
    }

    if (typeof idOrFilter === "number" || typeof idOrFilter === "string") {
      const rows = await db.select().from(dbTable).where(eq(dbTable.id, idOrFilter));
      return rows.length > 0 ? this.mapFromDrizzle(table, rows[0]) as DataTypes[T] : null;
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

    if (conditions.length === 0) {
        const rows = await db.select().from(dbTable);
        return rows.map(r => this.mapFromDrizzle(table, r)) as DataTypes[T][];
    }

    const rows = await db.select().from(dbTable).where(and(...conditions));
    return rows.map(r => this.mapFromDrizzle(table, r)) as DataTypes[T][];
  }

  async update<T extends Table>(
    table: T,
    idOrFilter: number | string | Partial<DataTypes[T]>,
    value: DataTypes[T] | Partial<DataTypes[T]>
  ): Promise<boolean> {
    const dbTable = tableMap[table];
    if (!dbTable) throw new Error(`Unknown table: ${table}`);

    const mappedValue = this.mapToDrizzle(table, value);

    if (typeof idOrFilter === "number" || typeof idOrFilter === "string") {
      await db.update(dbTable).set(mappedValue).where(eq(dbTable.id, idOrFilter));
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
        await db.update(dbTable).set(mappedValue).where(and(...conditions));
        return true;
    }

    return false;
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
    
    Object.keys(result).forEach(key => result[key] === undefined && delete result[key]);
    return result;
  }

  private mapFromDrizzle(table: Table, value: any): any {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
        const newKey = this.toSnakeCase(key);
        result[newKey] = val;
    }

    // Special handling for match status
    // brackets-viewer expects 'status' to be an integer (which we stored in bracketStatus)
    // We overwrite the 'status' field (which contains the DB enum string) with the integer
    if (table === 'match' && value.bracketStatus !== undefined) {
        result.status = value.bracketStatus;
    }

    return result;
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
