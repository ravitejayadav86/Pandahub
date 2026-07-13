"""
Redis-backed rate limiting.

Applied specifically to auth endpoints (login, password reset request,
resend verification) at the APPLICATION layer, in addition to the
coarser per-IP limit Nginx already applies -- Nginx protects the whole
server from generic abuse, but this layer can rate-limit by a more
specific key (e.g. per-email-address on password reset) that Nginx has
no visibility into, which is what actually stops a targeted
credential-stuffing attempt against one account.

Fixed-window counter (not sliding window / token bucket) is a deliberate
simplification: it's one INCR + one EXPIRE per check, cheap enough to run
on every auth request, and "good enough" precision for abuse prevention --
a sliding window would cost more Redis round-trips for marginal benefit here.
"""
import redis.asyncio as aioredis
from fastapi import HTTPException, Request, status

from app.core.config import get_settings

settings = get_settings()
_redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)


class RateLimiter:
    """Usage: `Depends(RateLimiter(key_prefix="login", limit=5, window_seconds=60))`"""

    def __init__(self, key_prefix: str, limit: int, window_seconds: int):
        self.key_prefix = key_prefix
        self.limit = limit
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{self.key_prefix}:{client_ip}"

        current = await _redis.incr(key)
        if current == 1:
            await _redis.expire(key, self.window_seconds)

        if current > self.limit:
            ttl = await _redis.ttl(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Try again in {max(ttl, 1)} seconds.",
            )


# Pre-configured instances for common auth endpoints
login_rate_limiter = RateLimiter(key_prefix="login", limit=10, window_seconds=60)
register_rate_limiter = RateLimiter(key_prefix="register", limit=5, window_seconds=300)
password_reset_rate_limiter = RateLimiter(key_prefix="pwreset", limit=3, window_seconds=300)
