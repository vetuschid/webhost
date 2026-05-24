from __future__ import annotations

from cryptography.fernet import Fernet

from .config import ensure_master_key


def _cipher() -> Fernet:
    return Fernet(ensure_master_key())


def encrypt(plaintext: str) -> str:
    return _cipher().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str:
    return _cipher().decrypt(ciphertext.encode("ascii")).decode("utf-8")


def last4(plaintext: str) -> str:
    s = plaintext.strip()
    return s[-4:] if len(s) >= 4 else "*" * len(s)
