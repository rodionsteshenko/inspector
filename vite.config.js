import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Vite plugin that adds /api/conversation and /api/questions to the dev server. */
function apiPlugin() {
  return {
    name: 'mafia-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/conversation') {
          const { handleConversation } = await import('./src/server/api.js');
          return handleConversation(req, res);
        }
        if (req.url === '/api/questions') {
          const { handleQuestions } = await import('./src/server/api.js');
          return handleQuestions(req, res);
        }
        if (req.url === '/api/testimony') {
          const { handleTestimony } = await import('./src/server/api.js');
          return handleTestimony(req, res);
        }
        return next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { port: 5181 },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
