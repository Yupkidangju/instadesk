import { handleProxyRequest } from './proxy';

export default {
  fetch(request: Request, env: { ALLOWED_ORIGIN: string }) {
    return handleProxyRequest(request, env);
  },
};
