import pytest
from app.models.models import RoleEnum, User

def test_user_roles():
    admin = User(username="admin_test", email="admin@test.com", password_hash="hash", role=RoleEnum.ADMIN)
    standard_user = User(username="user_test", email="user@test.com", password_hash="hash", role=RoleEnum.USER)
    
    assert admin.role == RoleEnum.ADMIN
    assert standard_user.role == RoleEnum.USER
    assert admin.role != standard_user.role
