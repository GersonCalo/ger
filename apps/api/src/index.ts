import { app } from './app.js';
import { env } from './config/env.js';
import { ensureGlobalCategories } from './lib/ensureGlobalCategories.js';

const PORT = env.PORT;

const start = async () => {
  await ensureGlobalCategories();

  app.listen(PORT, () => {
    console.log(`API escuchando en puerto ${PORT} en entorno ${env.NODE_ENV}`);
  });
};

start().catch((error) => {
  console.error('No se pudo iniciar la API', error);
  process.exit(1);
});
