import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/** Cliente de Claude. Solo se importa en el servidor: la clave nunca llega al navegador. */
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODELO = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
