import { ActionFunctionArgs, json } from '@remix-run/node';
import { performHealthCheck, getMetrics } from '../utils/health.server.js';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const health = await performHealthCheck();
    return json(health);
  } catch (error) {
    return json(
      { 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 503 }
    );
  }
}

export async function loader() {
  try {
    const health = await performHealthCheck();
    return json(health);
  } catch (error) {
    return json(
      { 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 503 }
    );
  }
}
