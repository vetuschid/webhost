from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from sse_starlette.sse import EventSourceResponse


def sse_response(generator: AsyncIterator[dict[str, Any]]) -> EventSourceResponse:
    """Wrap an async dict-generator into an SSE response. Each dict becomes one event."""

    async def _adapt() -> AsyncIterator[dict[str, str]]:
        async for item in generator:
            yield {"data": json.dumps(item, default=str)}

    return EventSourceResponse(_adapt())
