declare module "indonesian-badwords" {
  export interface BadwordAnalyzeResult {
    text?: string;
    words?: number;
    censored?: string;
    badwords?: string[];
    count?: number;
    locations?: Array<{ word: string; index: number }>;
  }

  export function analyze(text: string): BadwordAnalyzeResult;
  export function flag(text: string): boolean;
  export function filter(text: string): string;
  export function censor(text: string): string;

  const value: {
    analyze: typeof analyze;
    flag: typeof flag;
    filter: typeof filter;
    censor: typeof censor;
    dict?: unknown;
    badwords?: unknown;
  };
  export default value;
}
