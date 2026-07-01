export type CategoryCandidate = {
  id: string;
  name: string;
};

export type CategorySuggestion = {
  categoryId: string;
  name: string;
};

/**
 * Diccionario de conceptos → palabras clave habituales en España. Un concepto
 * solo produce sugerencia si el usuario tiene una categoría cuyo nombre
 * coincide con él: nunca se inventan categorías.
 */
const CONCEPT_KEYWORDS: Record<string, string[]> = {
  supermercado: ['mercadona', 'lidl', 'carrefour', 'aldi', 'dia', 'eroski', 'alcampo', 'super', 'compra'],
  transporte: ['gasolina', 'diesel', 'repsol', 'cepsa', 'taxi', 'uber', 'cabify', 'metro', 'bus', 'autobus', 'tren', 'renfe', 'parking', 'peaje'],
  cafe: ['cafe', 'cafes', 'cafeteria', 'starbucks', 'desayuno'],
  restaurante: ['restaurante', 'restaurantes', 'cena', 'comida', 'pizza', 'burger', 'kebab', 'sushi', 'bar', 'tapas'],
  ocio: ['cine', 'netflix', 'spotify', 'hbo', 'disney', 'concierto', 'videojuego', 'juego'],
  salud: ['farmacia', 'medico', 'dentista', 'gimnasio', 'gym'],
  hogar: ['alquiler', 'luz', 'agua', 'gas', 'internet', 'ikea'],
  ropa: ['zara', 'primark', 'hm', 'ropa', 'zapatos'],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const tokenize = (value: string) => normalize(value).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Servicio de dominio puro: sugiere una categoría existente del usuario a
 * partir de la nota del movimiento. Determinista y sin dependencias externas;
 * sirve además de base para un proveedor de IA futuro.
 */
export const suggestCategory = ({
  note,
  categories,
}: {
  note: string;
  categories: CategoryCandidate[];
}): CategorySuggestion | null => {
  if (!note.trim() || categories.length === 0) return null;

  const tokens = tokenize(note);
  if (tokens.length === 0) return null;

  const normalizedCategories = categories.map(category => ({
    ...category,
    normalizedName: normalize(category.name),
    nameTokens: tokenize(category.name),
  }));

  // 1) Coincidencia directa: algún token de la nota aparece en el nombre de la categoría.
  for (const category of normalizedCategories) {
    if (tokens.some(token => category.nameTokens.some(nameToken => nameToken === token || nameToken.startsWith(token) || token.startsWith(nameToken)))) {
      return { categoryId: category.id, name: category.name };
    }
  }

  // 2) Palabras clave por concepto, solo si el usuario tiene una categoría que encaje con el concepto.
  for (const [concept, keywords] of Object.entries(CONCEPT_KEYWORDS)) {
    if (!tokens.some(token => keywords.includes(token))) continue;

    const match = normalizedCategories.find(category =>
      category.nameTokens.some(nameToken => nameToken.startsWith(concept) || concept.startsWith(nameToken))
    );

    if (match) {
      return { categoryId: match.id, name: match.name };
    }
  }

  return null;
};
