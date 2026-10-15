// Worker mínimo de Neon Syndicate: todo el juego son archivos estáticos.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
