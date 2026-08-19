import { describe, it, expect } from 'vitest'
import { firstNameFrom, buildGreeting } from '../../src/shared/greeting'

describe('firstNameFrom', () => {
  it('takes the first token of a full name', () => {
    expect(firstNameFrom('Akwasi Fosuhene')).toBe('Akwasi')
    expect(firstNameFrom('Elvia Sanchez Ruiz')).toBe('Elvia')
  })

  it('capitalises a lowercase first name when a surname is present', () => {
    expect(firstNameFrom('elvia sanchez')).toBe('Elvia')
  })

  it('preserves hyphenated and apostrophised names', () => {
    expect(firstNameFrom('Anne-Marie Dubois')).toBe('Anne-Marie')
    expect(firstNameFrom("O'Neill Murphy")).toBe("O'Neill")
  })

  it('handles non-ascii names', () => {
    expect(firstNameFrom('Ólafur Arnalds')).toBe('Ólafur')
    expect(firstNameFrom('张 伟')).toBe('张')
  })

  // The case that motivated the whole module: greeting someone by their
  // login shortname reads worse than not greeting them at all.
  it('rejects a bare login shortname', () => {
    expect(firstNameFrom('akwasifosuhene')).toBeNull()
    expect(firstNameFrom('jsmith')).toBeNull()
  })

  it('rejects handles, emails and paths', () => {
    expect(firstNameFrom('user_42')).toBeNull()
    expect(firstNameFrom('dev2')).toBeNull()
    expect(firstNameFrom('me@example.com')).toBeNull()
    expect(firstNameFrom('/Users/someone')).toBeNull()
  })

  it('rejects empty and whitespace-only input', () => {
    expect(firstNameFrom('')).toBeNull()
    expect(firstNameFrom('   ')).toBeNull()
    expect(firstNameFrom(null)).toBeNull()
    expect(firstNameFrom(undefined)).toBeNull()
  })

  it('drops the gecos comma tail', () => {
    expect(firstNameFrom('Jane Doe,,,')).toBe('Jane')
  })

  it('rejects an implausibly long token', () => {
    expect(firstNameFrom('A'.repeat(40) + ' Smith')).toBeNull()
  })

  // A capitalised single token is a plausible name, unlike a lowercase one.
  it('accepts a single capitalised token', () => {
    expect(firstNameFrom('Elvia')).toBe('Elvia')
  })
})

describe('buildGreeting', () => {
  it('addresses the user by name when there is one', () => {
    expect(buildGreeting('Elvia')).toBe("Hi Elvia, let's build something great together")
  })

  it('falls back to an impersonal greeting without a name', () => {
    expect(buildGreeting(null)).toBe("Let's build something great together")
  })
})
