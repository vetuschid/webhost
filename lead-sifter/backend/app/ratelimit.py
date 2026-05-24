from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field


@dataclass
class TokenBucket:
    """Simple async token bucket: `rate` tokens per `per` seconds, burst = `capacity`."""

    rate: float
    per: float
    capacity: float
    _tokens: float = field(init=False)
    _last: float = field(init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    def __post_init__(self) -> None:
        self._tokens = self.capacity
        self._last = time.monotonic()

    async def acquire(self, n: float = 1.0) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                elapsed = now - self._last
                self._last = now
                self._tokens = min(self.capacity, self._tokens + elapsed * (self.rate / self.per))
                if self._tokens >= n:
                    self._tokens -= n
                    return
                deficit = n - self._tokens
                sleep_for = deficit * (self.per / self.rate)
                await asyncio.sleep(sleep_for)


# GHL: 100 req / 10s, 200k / day. Single shared bucket for the burst window.
GHL_BURST = TokenBucket(rate=100, per=10.0, capacity=100)
GHL_DAILY = TokenBucket(rate=200_000, per=86_400.0, capacity=200_000)
GHL_SEM = asyncio.Semaphore(8)


async def ghl_gate() -> None:
    await GHL_BURST.acquire()
    await GHL_DAILY.acquire()
