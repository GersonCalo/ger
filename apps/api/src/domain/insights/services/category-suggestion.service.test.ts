import { describe, it, expect } from 'vitest';

import { suggestCategory } from './category-suggestion.service';

const categories = [
  { id: 'cat-super', name: 'Supermercado' },
  { id: 'cat-transporte', name: 'Transporte' },
  { id: 'cat-cafe', name: 'Cafés' },
  { id: 'cat-ocio', name: 'Ocio' },
  { id: 'cat-restaurantes', name: 'Restaurantes' },
];

describe('suggestCategory (categorización automática)', () => {
  it('sugiere por coincidencia directa con el nombre de la categoría', () => {
    const suggestion = suggestCategory({ note: 'Compra supermercado semanal', categories });

    expect(suggestion?.categoryId).toBe('cat-super');
  });

  it('sugiere por palabras clave conocidas: comercios de supermercado', () => {
    expect(suggestCategory({ note: 'Mercadona', categories })?.categoryId).toBe('cat-super');
    expect(suggestCategory({ note: 'compra en LIDL', categories })?.categoryId).toBe('cat-super');
  });

  it('sugiere transporte para gasolina, taxi o metro', () => {
    expect(suggestCategory({ note: 'Gasolina Repsol', categories })?.categoryId).toBe('cat-transporte');
    expect(suggestCategory({ note: 'taxi aeropuerto', categories })?.categoryId).toBe('cat-transporte');
    expect(suggestCategory({ note: 'abono metro', categories })?.categoryId).toBe('cat-transporte');
  });

  it('ignora mayúsculas y acentos', () => {
    expect(suggestCategory({ note: 'CAFÉ con leche', categories })?.categoryId).toBe('cat-cafe');
    expect(suggestCategory({ note: 'cafe con leche', categories })?.categoryId).toBe('cat-cafe');
  });

  it('devuelve null si no hay coincidencias', () => {
    expect(suggestCategory({ note: 'xyz sin relación', categories })).toBeNull();
  });

  it('devuelve null con nota vacía o sin categorías', () => {
    expect(suggestCategory({ note: '', categories })).toBeNull();
    expect(suggestCategory({ note: 'Mercadona', categories: [] })).toBeNull();
  });

  it('nunca inventa: la sugerencia siempre es una categoría existente del usuario', () => {
    const suggestion = suggestCategory({
      note: 'cena restaurante italiano',
      categories: [{ id: 'cat-unica', name: 'Gastos varios' }],
    });

    // "restaurante" no existe entre las categorías del usuario → null, no una inventada
    expect(suggestion).toBeNull();
  });
});
