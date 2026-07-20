from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome" in response.json()["message"]

def test_register_and_login():
    # Register a new user
    user_payload = {
        "email": "testuser@example.com",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    # Clear if existing (if in SQLite memory/persistent file)
    # Using unique email for safety
    import random
    email = f"user_{random.randint(1000, 9999)}@example.com"
    user_payload["email"] = email
    
    response = client.post("/api/v1/auth/register", json=user_payload)
    assert response.status_code == 200
    assert response.json()["email"] == email
    
    # Login
    login_data = {
        "username": email,
        "password": "testpassword123"
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    
    token = response.json()["access_token"]
    
    # Get me
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == email
