import hashlib
import secrets

from django.contrib.auth.hashers import BasePasswordHasher, mask_hash
from django.utils.crypto import constant_time_compare


class LegacyPBKDF2PasswordHasher(BasePasswordHasher):
    """Verifies passwords imported from the pre-Django server (server.py).

    That server stored "pbkdf2_sha256$<rounds>$<salt as hex>$<digest as hex>"; the import command
    renames the prefix to this hasher's algorithm. It is never the preferred hasher, so Django
    re-hashes each password with Argon2 the first time its owner signs in.
    """

    algorithm = "legacy_pbkdf2_sha256"
    iterations = 390_000

    def salt(self):
        return secrets.token_hex(16)

    def encode(self, password, salt, iterations=None):
        iterations = iterations or self.iterations
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), iterations)
        return f"{self.algorithm}${iterations}${salt}${digest.hex()}"

    def decode(self, encoded):
        algorithm, iterations, salt, digest = encoded.split("$", 3)
        if algorithm != self.algorithm:
            raise ValueError("Not a legacy password hash.")
        return {"algorithm": algorithm, "iterations": int(iterations), "salt": salt, "hash": digest}

    def verify(self, password, encoded):
        decoded = self.decode(encoded)
        return constant_time_compare(self.encode(password, decoded["salt"], decoded["iterations"]), encoded)

    def safe_summary(self, encoded):
        decoded = self.decode(encoded)
        return {
            "algorithm": decoded["algorithm"],
            "iterations": decoded["iterations"],
            "salt": mask_hash(decoded["salt"]),
            "hash": mask_hash(decoded["hash"]),
        }

    def must_update(self, encoded):
        return True

    def harden_runtime(self, password, encoded):
        pass
