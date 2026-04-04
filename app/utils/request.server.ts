import { Headers } from '@remix-run/node';

export function getClientIp(request: Request): string | undefined {
  const headers = request.headers;
  
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return undefined;
}

export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

export function getRequestId(): string {
  return `req:${Date.now()}:${Math.random().toString(36).slice(2, 11)}`;
}
