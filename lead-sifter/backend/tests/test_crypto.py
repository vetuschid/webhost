from __future__ import annotations

from app import crypto


def test_encrypt_decrypt_roundtrip():
    secret = "sk-test-1234567890"
    ct = crypto.encrypt(secret)
    assert ct != secret
    assert crypto.decrypt(ct) == secret


def test_last4_masks_short_strings():
    assert crypto.last4("abcdef") == "cdef"
    assert crypto.last4("ab") == "**"
