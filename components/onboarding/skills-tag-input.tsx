/**
 * SkillsTagInput — Multi-select tag input for skills (max 20).
 *
 * UX:
 *  - Suggested skills shown as clickable chips
 *  - Free-text input to add custom skills
 *  - Added skills shown as dismissible badges
 *  - Max 20 skills enforced
 *  - Case-insensitive deduplication
 *
 * Accessibility:
 *  - role="list" on the tag area with aria-label
 *  - Each badge has aria-label="Remove {skill}"
 *  - Input has aria-describedby pointing to count + error
 *  - Live region announces add/remove actions
 */

'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SUGGESTED_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Go', 'Rust',
  'Next.js', 'Vue.js', 'Angular', 'PostgreSQL', 'MongoDB',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'DevOps', 'CI/CD',
  'GraphQL', 'REST API', 'Java', 'Kotlin', 'Swift', 'React Native',
  'Flutter', 'Tailwind CSS', 'CSS', 'Figma', 'Product Management',
  'Technical Writing', 'Data Science', 'Machine Learning', 'SQL',
]

const MAX_SKILLS = 20
const MIN_SKILL_LENGTH = 2
const MAX_SKILL_LENGTH = 50

interface SkillsTagInputProps {
  value: string[]
  onChange: (skills: string[]) => void
  error?: string
  disabled?: boolean
}

export function SkillsTagInput({
  value,
  onChange,
  error,
  disabled,
}: SkillsTagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const normalise = (s: string) => s.toLowerCase().trim()
  const isAlreadyAdded = useCallback(
    (skill: string) => value.some((v) => normalise(v) === normalise(skill)),
    [value]
  )

  const addSkill = useCallback(
    (skill: string) => {
      const trimmed = skill.trim()
      if (!trimmed) return
      if (trimmed.length < MIN_SKILL_LENGTH) return
      if (trimmed.length > MAX_SKILL_LENGTH) return
      if (isAlreadyAdded(trimmed)) return
      if (value.length >= MAX_SKILLS) return

      const next = [...value, trimmed]
      onChange(next)
      setAnnouncement(`${trimmed} added. ${next.length} of ${MAX_SKILLS} skills.`)
    },
    [value, onChange, isAlreadyAdded]
  )

  const removeSkill = useCallback(
    (skill: string) => {
      const next = value.filter((v) => normalise(v) !== normalise(skill))
      onChange(next)
      setAnnouncement(`${skill} removed. ${next.length} of ${MAX_SKILLS} skills.`)
    },
    [value, onChange]
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill(inputValue)
      setInputValue('')
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeSkill(value[value.length - 1]!)
    }
  }

  const remaining = MAX_SKILLS - value.length
  const countId = 'skills-count'
  const errorId = 'skills-error'

  return (
    <div className="flex flex-col gap-3">
      {/* Selected skills */}
      {value.length > 0 && (
        <div
          role="list"
          aria-label="Selected skills"
          className="flex flex-wrap gap-1.5"
        >
          {value.map((skill) => (
            <div key={skill} role="listitem">
              <Badge
                variant="secondary"
                className="flex items-center gap-1 pr-1 text-sm"
              >
                {skill}
                <button
                  type="button"
                  aria-label={`Remove ${skill}`}
                  disabled={disabled}
                  onClick={() => removeSkill(skill)}
                  className="ml-0.5 rounded-full hover:bg-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Free-text input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            value.length >= MAX_SKILLS
              ? 'Maximum skills reached'
              : 'Type a skill and press Enter…'
          }
          disabled={disabled || value.length >= MAX_SKILLS}
          aria-label="Add a skill"
          aria-describedby={`${countId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={!!error}
          className={cn(error && 'border-red-500 focus-visible:ring-red-500')}
          maxLength={MAX_SKILL_LENGTH}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled ||
            value.length >= MAX_SKILLS ||
            inputValue.trim().length < MIN_SKILL_LENGTH
          }
          onClick={() => {
            addSkill(inputValue)
            setInputValue('')
            inputRef.current?.focus()
          }}
          aria-label="Add skill"
        >
          Add
        </Button>
      </div>

      {/* Skill count */}
      <p
        id={countId}
        className={cn(
          'text-xs',
          remaining <= 3 ? 'text-amber-600' : 'text-text-muted'
        )}
      >
        {value.length} / {MAX_SKILLS} skills added
      </p>

      {/* Error */}
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      {/* Suggestions */}
      <div>
        <p className="mb-2 text-xs font-medium text-text-muted" id="suggestions-label">
          Quick add:
        </p>
        <div
          role="list"
          aria-labelledby="suggestions-label"
          className="flex flex-wrap gap-1.5"
        >
          {SUGGESTED_SKILLS.filter((s) => !isAlreadyAdded(s)).map((skill) => (
            <div key={skill} role="listitem">
              <button
                type="button"
                disabled={disabled || value.length >= MAX_SKILLS}
                onClick={() => addSkill(skill)}
                aria-label={`Add ${skill}`}
                className={cn(
                  'rounded-full border border-border px-2.5 py-0.5 text-xs text-text-muted transition-colors',
                  'hover:border-primary hover:text-primary',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'disabled:pointer-events-none disabled:opacity-40'
                )}
              >
                + {skill}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Live region for screen readers */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
