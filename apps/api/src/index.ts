import { app } from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT} en entorno ${env.NODE_ENV}`);
});
