export const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io/v1';
export const MINIMAX_DEFAULT_MODEL = 'MiniMax-M3';

type MiniMaxEnvironment = {
  MINIMAX_API_KEY?: string;
  MINIMAX_BASE_URL?: string;
  MINIMAX_MODEL?: string;
};

export const getMiniMaxConfig = (
  env: MiniMaxEnvironment = process.env as unknown as MiniMaxEnvironment
) => ({
  apiKey: env.MINIMAX_API_KEY?.trim() || undefined,
  baseURL: (env.MINIMAX_BASE_URL?.trim() || MINIMAX_DEFAULT_BASE_URL).replace(
    /\/+$/,
    ''
  ),
  model: env.MINIMAX_MODEL?.trim() || MINIMAX_DEFAULT_MODEL,
});
