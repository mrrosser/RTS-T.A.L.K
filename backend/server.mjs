import { createApp } from './app.mjs';
import { logEvent } from './logger.mjs';

const port = Number(process.env.PORT || 8080);
const app = createApp();

app.listen(port, () => {
  logEvent('info', 'server.started', { port });
});
