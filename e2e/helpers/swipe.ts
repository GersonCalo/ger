import type { Locator, Page } from '@playwright/test';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeOptions {
  steps?: number;
  duration?: number;
  distanceRatio?: number;
}

const DEFAULT_STEPS = 12;
const DEFAULT_DURATION = 200;
const DEFAULT_DISTANCE_RATIO = 0.5;

async function getElementCenter(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element boundingBox is null');
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    width: box.width,
    height: box.height,
  };
}

export async function swipe(
  page: Page,
  locator: Locator,
  direction: SwipeDirection = 'left',
  options: SwipeOptions = {}
) {
  const { x, y, width, height } = await getElementCenter(locator);
  const {
    steps = DEFAULT_STEPS,
    duration = DEFAULT_DURATION,
    distanceRatio = DEFAULT_DISTANCE_RATIO,
  } = options;

  const distance = Math.min(width, height) * distanceRatio;

  let startX = x;
  let startY = y;
  let endX = x;
  let endY = y;

  switch (direction) {
    case 'left':
      endX = x - distance;
      break;
    case 'right':
      endX = x + distance;
      break;
    case 'up':
      endY = y - distance;
      break;
    case 'down':
      endY = y + distance;
      break;
  }

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    await page.mouse.move(currentX, currentY);
    await page.waitForTimeout(duration / steps);
  }

  await page.mouse.up();
}

export async function swipeDrawerClose(page: Page, drawer: Locator) {
  const box = await drawer.boundingBox();
  if (!box) throw new Error('Drawer boundingBox is null');

  const startY = box.y + box.height / 2;
  const startX = box.x + box.width * 0.5;
  const endX = box.x - box.width * 0.6;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (let i = 1; i <= 12; i++) {
    const progress = i / 12;
    const currentX = startX + (endX - startX) * progress;
    await page.mouse.move(currentX, startY);
    await page.waitForTimeout(15);
  }

  await page.mouse.up();
}

export async function swipeRowOpen(page: Page, row: Locator) {
  const box = await row.boundingBox();
  if (!box) throw new Error('Row boundingBox is null');

  const startX = box.x + box.width * 0.75;
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width * 0.25;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (let i = 1; i <= 12; i++) {
    const progress = i / 12;
    const currentX = startX + (endX - startX) * progress;
    await page.mouse.move(currentX, startY);
    await page.waitForTimeout(15);
  }

  await page.mouse.up();
}
