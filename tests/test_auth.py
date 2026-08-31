import pytest
from app.utils.security import verify_password, get_password_hash, create_access_token, decode_access_token

def test_password_hashing():
    raw_pass = "ZyroPass2026!Secure"
    hashed = get_password_hash(raw_pass)
    
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False

def test_jwt_token_generation_and_decoding():
    user_id = "test-user-uuid-123"
    role = "ADMIN"
    token = create_access_token(subject=user_id, role=role)
    
    assert token is not None
    assert isinstance(token, str)
    
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == user_id
    assert payload.get("role") == role
