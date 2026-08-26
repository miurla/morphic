/**
 * Marks a preparation failure that depends only on the stored conversation or
 * request state. Replaying the same turn cannot make this failure succeed.
 */
export class DeterministicPreparationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeterministicPreparationError'
  }
}
