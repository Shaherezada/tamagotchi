import { matchesRoutingKey } from './event-handler';

describe('matchesRoutingKey', () => {
  it.each([
    ['pet.*', 'pet.hungry', true],
    ['pet.*', 'pet.hungry.extra', false],
    ['pet.#', 'pet.hungry.extra', true],
    ['#', 'user.registered', true],
    ['user.registered', 'user.registered', true],
    ['user.registered', 'pet.hungry', false],
    ['*.died', 'pet.died', true],
  ])('%s ~ %s = %s', (pattern, key, expected) => {
    expect(matchesRoutingKey(pattern, key)).toBe(expected);
  });
});
