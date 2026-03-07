import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WarningIndicator } from '@/components/charts/WarningIndicator'

afterEach(() => {
  cleanup()
})

describe('WarningIndicator', () => {
  // FR 4.4 - Visual only, not interruptive
  it('FR 4.4 — renders warning message without interrupting UI', () => {
    render(
      <WarningIndicator
        level="amber"
        message="3 consecutive discipline violations"
        triggeredBy={[1, 2, 3]}
      />
    )

    expect(screen.getByText(/3 consecutive discipline violations/i)).toBeInTheDocument()
  })

  // FR 4.4 - Yellow (amber) styling
  it('FR 4.4 — applies amber styling for amber level', () => {
    const { container } = render(
      <WarningIndicator
        level="amber"
        message="Test warning"
        triggeredBy={[1, 2, 3]}
      />
    )

    // Check for amber/yellow color classes
    const warningEl = container.firstChild as HTMLElement
    expect(warningEl.className).toContain('amber')
  })

  // FR 4.4 - Orange styling for orange level
  it('FR 4.4 — applies orange styling for orange level', () => {
    const { container } = render(
      <WarningIndicator
        level="orange"
        message="4+ consecutive discipline violations"
        triggeredBy={[1, 2, 3, 4]}
      />
    )

    const warningEl = container.firstChild as HTMLElement
    expect(warningEl.className).toContain('orange')
  })

  // FR 4.4 - No render for none level
  it('FR 4.4 — renders nothing for none level', () => {
    const { container } = render(
      <WarningIndicator
        level="none"
        message=""
        triggeredBy={[]}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  // FR 4.4 - Include tooltip explaining trigger
  it('FR 4.4 — includes tooltip with trigger information', () => {
    const { container } = render(
      <WarningIndicator
        level="amber"
        message="3 consecutive discipline violations"
        triggeredBy={[2, 3, 4]}
      />
    )

    // Should have tooltip showing which trades triggered it
    // Use container query to avoid finding multiple elements from other tests
    expect(container.querySelector('[title*="Triggered by"]')).toBeInTheDocument()
  })

  // FR 4.4 - Fade effect (transition)
  it('FR 4.4 — has fade transition styling', () => {
    const { container } = render(
      <WarningIndicator
        level="amber"
        message="Test"
        triggeredBy={[1, 2, 3]}
      />
    )

    const warningEl = container.firstChild as HTMLElement
    expect(warningEl.className).toContain('transition')
  })

  // Test message content
  it('displays the warning message correctly', () => {
    render(
      <WarningIndicator
        level="amber"
        message="Trading discipline warning"
        triggeredBy={[1]}
      />
    )

    expect(screen.getByText('Trading discipline warning')).toBeInTheDocument()
  })
})
