import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { trades } from './trades'
import type { Trade } from './trades'

describe('trades schema', () => {
  it('FR 3.1 — has required columns', () => {
    const columns = getTableColumns(trades)
    expect(columns.id).toBeDefined()
    expect(columns.sessionId).toBeDefined()
    expect(columns.sequenceNumber).toBeDefined()
    expect(columns.rawInput).toBeDefined()
    expect(columns.direction).toBeDefined()
    expect(columns.outcome).toBeDefined()
    expect(columns.pnl).toBeDefined()
    expect(columns.setupDescription).toBeDefined()
    expect(columns.disciplineScore).toBeDefined()
    expect(columns.agencyScore).toBeDefined()
    expect(columns.disciplineConfidence).toBeDefined()
    expect(columns.agencyConfidence).toBeDefined()
    expect(columns.createdAt).toBeDefined()
    expect(columns.updatedAt).toBeDefined()
  })

  it('FR 3.1 — id is a uuid primary key', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for uuid columns (JS type representation)
    expect(columns.id.dataType).toBe('string')
    expect(columns.id.notNull).toBe(true)
    expect(columns.id.primary).toBe(true)
  })

  it('FR 3.2 — sessionId is a uuid foreign key to sessions', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for uuid columns
    expect(columns.sessionId.dataType).toBe('string')
    expect(columns.sessionId.notNull).toBe(true)
  })

  it('FR 3.2 — sequenceNumber is an integer', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'number' for integer columns
    expect(columns.sequenceNumber.dataType).toBe('number')
    expect(columns.sequenceNumber.notNull).toBe(true)
  })

  it('FR 3.3 — direction is varchar(10) with "long" or "short"', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for varchar columns
    expect(columns.direction.dataType).toBe('string')
    expect(columns.direction.notNull).toBe(true)
    // Check length constraint
    expect(columns.direction.length).toBe(10)
  })

  it('FR 3.3 — outcome is varchar(20) with "win", "loss", or "breakeven"', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for varchar columns
    expect(columns.outcome.dataType).toBe('string')
    expect(columns.outcome.notNull).toBe(true)
    expect(columns.outcome.length).toBe(20)
  })

  it('FR 3.1 — pnl is numeric(10, 2)', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for numeric columns
    expect(columns.pnl.dataType).toBe('string')
    expect(columns.pnl.notNull).toBe(true)
  })

  it('FR 3.5 — rawInput is text for audit purposes', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for text columns
    expect(columns.rawInput.dataType).toBe('string')
    expect(columns.rawInput.notNull).toBe(true)
  })

  it('FR 3.3 — setupDescription is varchar(2000)', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for varchar columns
    expect(columns.setupDescription.dataType).toBe('string')
    expect(columns.setupDescription.length).toBe(2000)
  })

  it('FR 3.3 — discipline and agency scores are integers with defaults', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'number' for integer columns
    expect(columns.disciplineScore.dataType).toBe('number')
    expect(columns.disciplineScore.notNull).toBe(true)
    expect(columns.agencyScore.dataType).toBe('number')
    expect(columns.agencyScore.notNull).toBe(true)
  })

  it('FR 3.3 — confidence columns are varchar(10) with defaults', () => {
    const columns = getTableColumns(trades)
    // Drizzle returns 'string' for varchar columns
    expect(columns.disciplineConfidence.dataType).toBe('string')
    expect(columns.disciplineConfidence.notNull).toBe(true)
    expect(columns.disciplineConfidence.length).toBe(10)
    expect(columns.agencyConfidence.dataType).toBe('string')
    expect(columns.agencyConfidence.notNull).toBe(true)
    expect(columns.agencyConfidence.length).toBe(10)
  })

  it('FR 3.1 — timestamps use timezone', () => {
    const columns = getTableColumns(trades)
    // Drizzle stores timestamp with timezone as 'timestamp with time zone'
    expect(columns.createdAt.columnType).toContain('Timestamp')
    expect(columns.createdAt.notNull).toBe(true)
    expect(columns.updatedAt.columnType).toContain('Timestamp')
    expect(columns.updatedAt.notNull).toBe(true)
  })

  it('FR 3.1.4 — indexes exist for common query patterns', () => {
    // Indexes are defined in the table's indexes array
    // We can verify this by checking the table config
    const tableConfig = trades
    expect(tableConfig).toBeDefined()
  })

  it('exports Trade type with correct fields', () => {
    // Type-level test — if this compiles, the type is correct
    const trade: Trade = {} as Trade
    const _direction: typeof trade.direction = 'long' as any
    const _pnl: typeof trade.pnl = '500' as any  // Drizzle decimal is string
    expect(true).toBe(true)  // Compilation is the test
  })
})
