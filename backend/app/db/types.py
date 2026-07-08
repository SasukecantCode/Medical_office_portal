import base64
from sqlalchemy.types import TypeDecorator, String, TEXT
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings
import logging

class EncryptedString(TypeDecorator):
    """
    Transparently encrypts data on INSERT/UPDATE and decrypts on SELECT.
    Uses Fernet symmetric encryption.
    """
    impl = String
    cache_ok = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fernet = None
        if settings.field_encryption_key:
            try:
                # Ensure it's a valid 32-byte base64 encoded key
                self.fernet = Fernet(settings.field_encryption_key.encode())
            except Exception as e:
                logging.error(f"Invalid FIELD_ENCRYPTION_KEY: {e}")

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(String(1000))  # Encrypted strings are much longer

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not self.fernet:
            logging.warning("FIELD_ENCRYPTION_KEY not set. Storing plaintext (NOT SECURE).")
            return value
        # Encrypt the string
        try:
            return self.fernet.encrypt(value.encode('utf-8')).decode('utf-8')
        except Exception as e:
            logging.error(f"Encryption failed: {e}")
            return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if not self.fernet:
            return value
        try:
            # Check if it looks like a fernet token
            if not value.startswith('gAAAAA'):
                return value # Assume legacy plaintext
            return self.fernet.decrypt(value.encode('utf-8')).decode('utf-8')
        except InvalidToken:
            # Fallback for plain text or invalid tokens
            return value
        except Exception as e:
            logging.error(f"Decryption failed: {e}")
            return value
