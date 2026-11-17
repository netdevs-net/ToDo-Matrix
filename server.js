import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApp } from './server/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = await createApp({
  // Keep this outside the checkout in a real deployment: inside it, a
  // `git clean` takes the blob with it.
  dataDir: process.env.DATA_DIR || join(__dirname, 'data'),
  token: process.env.SYNC_TOKEN,
  staticDir: join(__dirname, 'dist'),
  isDevelopment: process.env.NODE_ENV === 'development',
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  if (!process.env.SYNC_TOKEN) {
    console.log('SYNC_TOKEN is not set: the sync API will answer 503.');
  }
});
