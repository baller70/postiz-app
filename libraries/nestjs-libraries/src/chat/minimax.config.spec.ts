import {
  getMiniMaxConfig,
  MINIMAX_DEFAULT_BASE_URL,
  MINIMAX_DEFAULT_MODEL,
} from './minimax.config';
import { describe, expect, it } from 'vitest';

describe('getMiniMaxConfig', () => {
  it('uses the MiniMax M3 OpenAI-compatible defaults', () => {
    expect(getMiniMaxConfig({})).toEqual({
      apiKey: undefined,
      baseURL: MINIMAX_DEFAULT_BASE_URL,
      model: MINIMAX_DEFAULT_MODEL,
    });
  });

  it('reads dedicated MiniMax variables and normalizes the base URL', () => {
    expect(
      getMiniMaxConfig({
        MINIMAX_API_KEY: ' secret-key ',
        MINIMAX_BASE_URL: 'https://api.minimax.io/v1/',
        MINIMAX_MODEL: ' MiniMax-M3 ',
      })
    ).toEqual({
      apiKey: 'secret-key',
      baseURL: 'https://api.minimax.io/v1',
      model: 'MiniMax-M3',
    });
  });
});
