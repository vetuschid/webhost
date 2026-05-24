from __future__ import annotations

import os
import tempfile

import pytest

# Point Lead Sifter at a tmp dir so tests don't touch the real ~/.lead-sifter
@pytest.fixture(scope="session", autouse=True)
def _isolated_home():
    d = tempfile.mkdtemp(prefix="lead-sifter-tests-")
    os.environ["LEAD_SIFTER_HOME"] = d
    # Reset settings cache
    from app.config import get_settings

    get_settings.cache_clear()  # type: ignore[attr-defined]
    yield
