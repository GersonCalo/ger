import { app } from './app';
import { env } from './config/env';

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT} en entorno ${env.NODE_ENV}`);
});
