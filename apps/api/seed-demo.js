/**
 * Seed script: genera transacciones de 1 año para ver el gráfico de balance.
 *
 * Uso:
 *   node apps/api/seed-demo.js
 *
 * Te pedirá tu email y contraseña para autenticarse.
 * Genera ~200 transacciones (ingresos y gastos) distribuidas en los últimos 365 días.
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const API_BASE = process.env.API_URL || 'http://localhost:8080/api/v1';

// --- Datos de demo ---
const INCOME_CATEGORIES = [
  { name: 'Salario', icon: '💼' },
  { name: 'Freelance', icon: '💻' },
  { name: 'Inversiones', icon: '📈' },
  { name: 'Regalo', icon: '🎁' },
  { name: 'Reembolso', icon: '↩️' },
];

const EXPENSE_CATEGORIES = [
  { name: 'Comida', icon: '🍕' },
  { name: 'Transporte', icon: '🚌' },
  { name: 'Alquiler', icon: '🏠' },
  { name: 'Supermercado', icon: '🛒' },
  { name: 'Ocio', icon: '🎮' },
  { name: 'Restaurantes', icon: '🍽️' },
  { name: 'Ropa', icon: '👕' },
  { name: 'Salud', icon: '🏥' },
  { name: 'Suscripciones', icon: '📺' },
  { name: 'Gasolina', icon: '⛽' },
];

const INCOME_AMOUNTS = [
  [1800, 2200], // Salario
  [200, 500],   // Freelance
  [50, 150],    // Inversiones
  [20, 100],    // Regalo
  [30, 80],     // Reembolso
];

const EXPENSE_AMOUNTS = [
  [8, 25],      // Comida
  [10, 30],     // Transporte
  [600, 800],   // Alquiler (una vez al mes)
  [40, 120],    // Supermercado
  [15, 50],     // Ocio
  [20, 60],     // Restaurantes
  [30, 80],     // Ropa
  [15, 40],     // Salud
  [10, 20],     // Suscripciones
  [40, 60],     // Gasolina
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function randomDate(daysAgo) {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const random = new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
  return random.toISOString();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('🌱 Seed de datos demo — último mes\n');

  // Leer credenciales
  const rl = readline.createInterface({ input, output });

  const email = await rl.question('📧 Email: ');
  const password = await rl.question('🔒 Contraseña: ');
  rl.close();

  console.log('\n🔐 Autenticando...');

  // Login
  const loginRes = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const token = loginRes.token;
  console.log('✅ Autenticado\n');

  // Crear categorías si no existen
  console.log('📂 Creando categorías...');
  const createdCategories = {};

  for (const cat of [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]) {
    try {
      const res = await api('/categories', {
        method: 'POST',
        token,
        body: { name: cat.name, type: cat.name === 'Salario' || cat.name === 'Freelance' || cat.name === 'Inversiones' || cat.name === 'Regalo' || cat.name === 'Reembolso' ? 'income' : 'expense', icon: cat.icon },
      });
      createdCategories[cat.name] = res.category.id;
    } catch {
      // Ya existe — buscarla
      const cats = await api('/categories', { token });
      const list = cats.categories || cats || [];
      const found = list.find(c => c.name === cat.name && c.groupId === null);
      if (found) createdCategories[cat.name] = found.id;
    }
  }
  console.log(`   ${Object.keys(createdCategories).length} categorías listas\n`);

  // Generar transacciones (1 año completo = 365 días)
  const transactions = [];

  // Salario (1 por mes = 12)
  for (let m = 0; m < 12; m++) {
    const dayOffset = randomInt(0, 5); // día 1-6 de cada mes
    transactions.push({
      type: 'income',
      amount: randomFloat(...INCOME_AMOUNTS[0]),
      categoryId: createdCategories['Salario'],
      note: 'Nómina mensual',
      occurredAt: randomDate(30 * m + dayOffset),
    });
  }

  // Alquiler (1 por mes = 12)
  for (let m = 0; m < 12; m++) {
    const dayOffset = randomInt(3, 8);
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[2]),
      categoryId: createdCategories['Alquiler'],
      note: 'Alquiler mensual',
      occurredAt: randomDate(30 * m + dayOffset),
    });
  }

  // Supermercado (2-3 veces por semana × 52 semanas ≈ 100)
  for (let i = 0; i < 100; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[3]),
      categoryId: createdCategories['Supermercado'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Comida fuera (1-2 veces por semana × 52 ≈ 75)
  for (let i = 0; i < 75; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[0]),
      categoryId: createdCategories['Comida'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Transporte (1-2 veces por semana × 52 ≈ 60)
  for (let i = 0; i < 60; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[1]),
      categoryId: createdCategories['Transporte'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Ocio (1 vez por semana × 52 ≈ 50)
  for (let i = 0; i < 50; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[4]),
      categoryId: createdCategories['Ocio'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Restaurantes (2-3 veces por mes × 12 ≈ 30)
  for (let i = 0; i < 30; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[5]),
      categoryId: createdCategories['Restaurantes'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Gasolina (2 veces por mes × 12 ≈ 24)
  for (let i = 0; i < 24; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[9]),
      categoryId: createdCategories['Gasolina'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Suscripciones (1 por mes × 12)
  for (let m = 0; m < 12; m++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[8]),
      categoryId: createdCategories['Suscripciones'],
      note: 'Netflix / Spotify / etc.',
      occurredAt: randomDate(30 * m + randomInt(1, 5)),
    });
  }

  // Ropa (1-2 veces por mes × 12 ≈ 18)
  for (let i = 0; i < 18; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[6]),
      categoryId: createdCategories['Ropa'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Salud (1 vez por mes × 12 ≈ 12)
  for (let i = 0; i < 12; i++) {
    transactions.push({
      type: 'expense',
      amount: randomFloat(...EXPENSE_AMOUNTS[7]),
      categoryId: createdCategories['Salud'],
      note: '',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Ingresos extra
  // Freelance (2-3 por año)
  for (let i = 0; i < randomInt(2, 3); i++) {
    transactions.push({
      type: 'income',
      amount: randomFloat(...INCOME_AMOUNTS[1]),
      categoryId: createdCategories['Freelance'],
      note: 'Proyecto freelance',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Inversiones (4 por año = trimestral)
  for (let i = 0; i < 4; i++) {
    transactions.push({
      type: 'income',
      amount: randomFloat(...INCOME_AMOUNTS[2]),
      categoryId: createdCategories['Inversiones'],
      note: 'Dividendos trimestrales',
      occurredAt: randomDate(90 * i + randomInt(1, 15)),
    });
  }

  // Regalos (3-5 por año)
  for (let i = 0; i < randomInt(3, 5); i++) {
    transactions.push({
      type: 'income',
      amount: randomFloat(...INCOME_AMOUNTS[3]),
      categoryId: createdCategories['Regalo'],
      note: 'Cumpleaños / Navidad',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Reembolsos (2-4 por año)
  for (let i = 0; i < randomInt(2, 4); i++) {
    transactions.push({
      type: 'income',
      amount: randomFloat(...INCOME_AMOUNTS[4]),
      categoryId: createdCategories['Reembolso'],
      note: 'Devolución',
      occurredAt: randomDate(randomInt(1, 365)),
    });
  }

  // Sort by date (oldest first for chronological creation)
  transactions.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  // Crear transacciones
  console.log(`📝 Creando ${transactions.length} transacciones...\n`);

  let incomeTotal = 0;
  let expenseTotal = 0;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    try {
      const res = await api('/transactions', {
        method: 'POST',
        token,
        body: tx,
      });
      const amt = Number(tx.amount);
      if (tx.type === 'income') incomeTotal += amt;
      else expenseTotal += amt;

      const date = new Date(tx.occurredAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      const icon = tx.note ? '' : (tx.categoryId ? '✓' : '');
      process.stdout.write(`  ${i + 1}/${transactions.length}  ${date}  ${tx.type === 'income' ? '+' : '-'}${tx.amount}€  ${icon}\n`);
    } catch (err) {
      console.error(`  ✗ Error en transacción ${i + 1}: ${err.message}`);
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   Ingresos: +${incomeTotal.toFixed(2)}€`);
  console.log(`   Gastos:   -${expenseTotal.toFixed(2)}€`);
  console.log(`   Balance:  ${(incomeTotal - expenseTotal).toFixed(2)}€`);
  console.log(`\n✅ ¡Listo! Abre http://localhost:3000 para ver el gráfico.`);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
