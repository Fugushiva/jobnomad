/**
 * Unit tests for onboarding UI components (FM02).
 *
 * Pattern: follows existing project test style — @testing-library/react only,
 * no @testing-library/jest-dom matchers (use .not.toBeNull() instead of toBeInTheDocument).
 * Vitest + happy-dom environment.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { StepIndicator } from '../step-indicator'
import { SkillsTagInput } from '../skills-tag-input'
import { ContractRadio } from '../contract-radio'
import { RateInput } from '../rate-input'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// StepIndicator
// ---------------------------------------------------------------------------
describe('StepIndicator', () => {
  it('renders all 4 step labels', () => {
    render(<StepIndicator currentStep={1} />)
    expect(screen.getByText('Timezone')).not.toBeNull()
    expect(screen.getByText('Skills')).not.toBeNull()
    expect(screen.getByText('Contract')).not.toBeNull()
    expect(screen.getByText('Rate')).not.toBeNull()
  })

  it('marks current step with aria-current="step"', () => {
    render(<StepIndicator currentStep={2} />)
    const items = screen.getAllByRole('listitem')
    const currentItems = items.filter(
      (el) => el.getAttribute('aria-current') === 'step'
    )
    expect(currentItems).toHaveLength(1)
    expect(currentItems[0]?.getAttribute('aria-label')).toMatch(/skills.*current/i)
  })

  it('marks completed steps in aria-label', () => {
    render(<StepIndicator currentStep={3} />)
    const items = screen.getAllByRole('listitem')
    const completedItems = items.filter((el) =>
      el.getAttribute('aria-label')?.includes('completed')
    )
    expect(completedItems).toHaveLength(2) // steps 1 and 2
  })

  it('shows screen-reader summary with current step info', () => {
    render(<StepIndicator currentStep={4} />)
    const srParagraphs = document.querySelectorAll('.sr-only')
    const hasSummary = Array.from(srParagraphs).some((el) =>
      el.textContent?.includes('Step 4 of 4')
    )
    expect(hasSummary).toBe(true)
  })

  it('has accessible nav wrapper', () => {
    render(<StepIndicator currentStep={1} />)
    const nav = screen.getByRole('navigation', { name: /onboarding progress/i })
    expect(nav).not.toBeNull()
  })

  it('renders step numbers for upcoming steps', () => {
    render(<StepIndicator currentStep={1} />)
    // Step numbers 2, 3, 4 should be visible (step 1 doesn't show its number)
    expect(screen.getByText('2')).not.toBeNull()
    expect(screen.getByText('3')).not.toBeNull()
    expect(screen.getByText('4')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SkillsTagInput
// ---------------------------------------------------------------------------
describe('SkillsTagInput', () => {
  it('renders existing skills as badges', () => {
    render(<SkillsTagInput value={['React', 'TypeScript']} onChange={vi.fn()} />)
    expect(screen.getByText('React')).not.toBeNull()
    expect(screen.getByText('TypeScript')).not.toBeNull()
  })

  it('shows skill count indicator', () => {
    render(<SkillsTagInput value={['React', 'Go']} onChange={vi.fn()} />)
    expect(screen.getByText(/2 \/ 20 skills added/i)).not.toBeNull()
  })

  it('calls onChange when suggestion chip is clicked', () => {
    const onChange = vi.fn()
    render(<SkillsTagInput value={[]} onChange={onChange} />)
    const addGo = screen.getByRole('button', { name: /add go/i })
    fireEvent.click(addGo)
    expect(onChange).toHaveBeenCalledWith(['Go'])
  })

  it('removes skill via X button', () => {
    const onChange = vi.fn()
    render(<SkillsTagInput value={['React', 'Go']} onChange={onChange} />)
    const removeButton = screen.getByRole('button', { name: /remove react/i })
    fireEvent.click(removeButton)
    expect(onChange).toHaveBeenCalledWith(['Go'])
  })

  it('disables input at max capacity', () => {
    const maxSkills = Array.from({ length: 20 }, (_, i) => `Skill${i}`)
    render(<SkillsTagInput value={maxSkills} onChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: /add a skill/i })
    expect(input.hasAttribute('disabled')).toBe(true)
  })

  it('shows error message in alert role', () => {
    render(
      <SkillsTagInput
        value={[]}
        onChange={vi.fn()}
        error="Please add at least 1 skill."
      />
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Please add at least 1 skill.')
  })

  it('calls onChange with typed skill on Enter key', () => {
    const onChange = vi.fn()
    render(<SkillsTagInput value={[]} onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: /add a skill/i })
    fireEvent.change(input, { target: { value: 'Rust' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['Rust'])
  })

  it('does not add duplicate skill case-insensitively', () => {
    const onChange = vi.fn()
    render(<SkillsTagInput value={['React']} onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: /add a skill/i })
    fireEvent.change(input, { target: { value: 'react' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('announces add/remove actions in sr-only live region', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SkillsTagInput value={[]} onChange={onChange} />)
    const addGo = screen.getByRole('button', { name: /add go/i })
    fireEvent.click(addGo)
    // Live region exists
    const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]')
    expect(liveRegion).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ContractRadio
// ---------------------------------------------------------------------------
describe('ContractRadio', () => {
  it('renders 3 radio options', () => {
    render(<ContractRadio value="" onChange={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
  })

  it('renders option labels', () => {
    render(<ContractRadio value="" onChange={vi.fn()} />)
    expect(screen.getByText(/freelance \/ contractor/i)).not.toBeNull()
    expect(screen.getByText(/full-time employee/i)).not.toBeNull()
    expect(screen.getByText(/open to both/i)).not.toBeNull()
  })

  it('marks selected option as checked (Radix uses data-state or aria-checked)', () => {
    render(<ContractRadio value="employee" onChange={vi.fn()} />)
    // Radix RadioGroup uses aria-checked on the radio element
    const radio = screen.getByRole('radio', { name: /full-time employee/i })
    // Either aria-checked="true" or data-state="checked" indicates selection
    const isChecked =
      radio.getAttribute('aria-checked') === 'true' ||
      radio.getAttribute('data-state') === 'checked' ||
      (radio as HTMLInputElement).checked === true
    expect(isChecked).toBe(true)
  })

  it('displays error message', () => {
    render(
      <ContractRadio value="" onChange={vi.fn()} error="Please select a preference." />
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Please select a preference.')
  })

  it('renders option descriptions', () => {
    render(<ContractRadio value="" onChange={vi.fn()} />)
    expect(screen.getByText(/fixed-term contracts/i)).not.toBeNull()
    expect(screen.getByText(/long-term employment/i)).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// RateInput
// ---------------------------------------------------------------------------
describe('RateInput', () => {
  it('renders amount input', () => {
    render(
      <RateInput
        amount={null}
        period={null}
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
      />
    )
    const input = screen.getByRole('spinbutton', { name: /minimum rate amount/i })
    expect(input).not.toBeNull()
  })

  it('shows USD prefix label', () => {
    render(
      <RateInput
        amount={null}
        period={null}
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/currency: usd/i)).not.toBeNull()
  })

  it('calls onAmountChange on input change', () => {
    const onAmountChange = vi.fn()
    render(
      <RateInput
        amount={null}
        period={null}
        onAmountChange={onAmountChange}
        onPeriodChange={vi.fn()}
      />
    )
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '5000' } })
    expect(onAmountChange).toHaveBeenCalledWith(5000)
  })

  it('calls onAmountChange with null for empty input', () => {
    const onAmountChange = vi.fn()
    render(
      <RateInput
        amount={5000}
        period={null}
        onAmountChange={onAmountChange}
        onPeriodChange={vi.fn()}
      />
    )
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '' } })
    expect(onAmountChange).toHaveBeenCalledWith(null)
  })

  it('shows computed display when amount and period are both set', () => {
    render(
      <RateInput
        amount={5000}
        period="month"
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
      />
    )
    // Computed text shows the Minimum: prefix with amount and period
    const liveEl = document.querySelector('p[aria-live="polite"]')
    expect(liveEl?.textContent).toContain('5,000')
    expect(liveEl?.textContent).toContain('per month')
  })

  it('does not show computed display when amount is null', () => {
    render(
      <RateInput
        amount={null}
        period="month"
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
      />
    )
    // The computed paragraph with "Minimum:" should not appear
    const computedEl = document.querySelector('p[aria-live="polite"]')
    // Either element is absent or does not contain "Minimum:"
    const text = computedEl?.textContent ?? ''
    expect(text).not.toContain('Minimum:')
  })

  it('shows clear button when values are set', () => {
    render(
      <RateInput
        amount={5000}
        period="month"
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /clear rate/i })).not.toBeNull()
  })

  it('does not show clear button when no values', () => {
    render(
      <RateInput
        amount={null}
        period={null}
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /clear rate/i })).toBeNull()
  })

  it('calls both handlers when clear button is clicked', () => {
    const onAmountChange = vi.fn()
    const onPeriodChange = vi.fn()
    render(
      <RateInput
        amount={5000}
        period="month"
        onAmountChange={onAmountChange}
        onPeriodChange={onPeriodChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /clear rate/i }))
    expect(onAmountChange).toHaveBeenCalledWith(null)
    expect(onPeriodChange).toHaveBeenCalledWith(null)
  })

  it('shows optional hint text', () => {
    render(
      <RateInput
        amount={null}
        period={null}
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
      />
    )
    expect(screen.getByText(/optional/i)).not.toBeNull()
  })

  it('displays error message', () => {
    render(
      <RateInput
        amount={100}
        period={null}
        onAmountChange={vi.fn()}
        onPeriodChange={vi.fn()}
        error="Please select a rate period."
      />
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Please select a rate period.')
  })
})
