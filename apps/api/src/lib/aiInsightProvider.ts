import {
  buildAiSummaryPrompt,
  generateLocalAiSummary,
  type AiSummaryInput,
} from '../domain/insights/services/ai-summary.service.js';

/**
 * Puerto para proveedores de análisis con IA. La implementación local es la
 * referencia de comportamiento; un proveedor externo (p. ej. Anthropic) debe
 * usar `buildAiSummaryPrompt(input)` como prompt y respetar la regla de no
 * inventar datos. Nunca registrar en logs el contenido del input.
 */
export type AiInsightProvider = {
  name: string;
  generateSummary(input: AiSummaryInput): Promise<string>;
};

export const localAiInsightProvider: AiInsightProvider = {
  name: 'local',
  async generateSummary(input) {
    return generateLocalAiSummary(input);
  },
};

export const getAiInsightProvider = (): AiInsightProvider => {
  // Punto único de selección de proveedor: cuando exista uno externo se
  // decidirá aquí por configuración (env), sin tocar rutas ni dominio.
  return localAiInsightProvider;
};

export { buildAiSummaryPrompt };
