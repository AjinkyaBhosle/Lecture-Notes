"""
Backend API tests for AI Lecture Companion
Tests: CRUD operations for lectures, audio upload, processing status
"""
import pytest
import requests
import os
from pathlib import Path

# Read EXPO_PUBLIC_BACKEND_URL from frontend .env
frontend_env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
BASE_URL = None
if frontend_env_path.exists():
    with open(frontend_env_path) as f:
        for line in f:
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in frontend/.env")

class TestLecturesCRUD:
    """Test lecture CRUD operations"""

    def test_health_check(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Health check passed: {data}")

    def test_list_lectures_initial(self):
        """Test GET /api/lectures - should return seeded lectures"""
        response = requests.get(f"{BASE_URL}/api/lectures")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List lectures: {len(data)} lectures found")
        
        # Verify seeded data exists
        if len(data) > 0:
            lecture = data[0]
            assert "id" in lecture
            assert "title" in lecture
            assert "status" in lecture
            assert "created_at" in lecture
            assert "_id" not in lecture  # MongoDB _id should be excluded
            print(f"✓ Lecture structure valid: {lecture['title']}")

    def test_create_lecture(self):
        """Test POST /api/lectures - create new lecture"""
        payload = {"title": "TEST_New Lecture"}
        response = requests.post(f"{BASE_URL}/api/lectures", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "TEST_New Lecture"
        assert data["status"] == "recorded"
        assert "id" in data
        assert "_id" not in data
        print(f"✓ Create lecture: {data['id']}")
        
        # Verify persistence with GET
        lecture_id = data["id"]
        get_response = requests.get(f"{BASE_URL}/api/lectures/{lecture_id}")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["title"] == "TEST_New Lecture"
        print(f"✓ Lecture persisted correctly")

    def test_get_lecture_by_id(self):
        """Test GET /api/lectures/{id} - get specific lecture"""
        # First create a lecture
        create_response = requests.post(
            f"{BASE_URL}/api/lectures",
            json={"title": "TEST_Get By ID"}
        )
        assert create_response.status_code == 200
        lecture_id = create_response.json()["id"]
        
        # Get the lecture
        response = requests.get(f"{BASE_URL}/api/lectures/{lecture_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == lecture_id
        assert data["title"] == "TEST_Get By ID"
        assert "_id" not in data
        print(f"✓ Get lecture by ID: {lecture_id}")

    def test_get_lecture_not_found(self):
        """Test GET /api/lectures/{id} - non-existent lecture"""
        response = requests.get(f"{BASE_URL}/api/lectures/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ 404 returned for non-existent lecture")

    def test_update_lecture_title(self):
        """Test PUT /api/lectures/{id} - update lecture title"""
        # Create lecture
        create_response = requests.post(
            f"{BASE_URL}/api/lectures",
            json={"title": "TEST_Original Title"}
        )
        lecture_id = create_response.json()["id"]
        
        # Update title
        update_response = requests.put(
            f"{BASE_URL}/api/lectures/{lecture_id}",
            json={"title": "TEST_Updated Title"}
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert updated_data["title"] == "TEST_Updated Title"
        print(f"✓ Update lecture title")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/lectures/{lecture_id}")
        assert get_response.json()["title"] == "TEST_Updated Title"
        print(f"✓ Title update persisted")

    def test_delete_lecture(self):
        """Test DELETE /api/lectures/{id} - delete lecture"""
        # Create lecture
        create_response = requests.post(
            f"{BASE_URL}/api/lectures",
            json={"title": "TEST_To Delete"}
        )
        lecture_id = create_response.json()["id"]
        
        # Delete lecture
        delete_response = requests.delete(f"{BASE_URL}/api/lectures/{lecture_id}")
        assert delete_response.status_code == 200
        print(f"✓ Delete lecture: {lecture_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/lectures/{lecture_id}")
        assert get_response.status_code == 404
        print(f"✓ Lecture deleted successfully (404 on GET)")

    def test_delete_lecture_not_found(self):
        """Test DELETE /api/lectures/{id} - non-existent lecture"""
        response = requests.delete(f"{BASE_URL}/api/lectures/nonexistent-id-99999")
        assert response.status_code == 404
        print(f"✓ 404 returned when deleting non-existent lecture")

    def test_get_processing_status(self):
        """Test GET /api/lectures/{id}/status - get processing status"""
        # Create lecture
        create_response = requests.post(
            f"{BASE_URL}/api/lectures",
            json={"title": "TEST_Status Check"}
        )
        lecture_id = create_response.json()["id"]
        
        # Get status
        status_response = requests.get(f"{BASE_URL}/api/lectures/{lecture_id}/status")
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert "lecture_id" in status_data
        assert "status" in status_data
        assert "step" in status_data
        assert "progress" in status_data
        assert "message" in status_data
        assert status_data["status"] == "recorded"
        print(f"✓ Processing status: {status_data['status']} - {status_data['message']}")

    def test_get_status_not_found(self):
        """Test GET /api/lectures/{id}/status - non-existent lecture"""
        response = requests.get(f"{BASE_URL}/api/lectures/fake-id-123/status")
        assert response.status_code == 404
        print(f"✓ 404 returned for status of non-existent lecture")


class TestDataValidation:
    """Test data validation and edge cases"""

    def test_create_lecture_default_title(self):
        """Test creating lecture without title uses default"""
        response = requests.post(f"{BASE_URL}/api/lectures", json={})
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Untitled Lecture"
        print(f"✓ Default title applied: {data['title']}")

    def test_mongodb_id_excluded(self):
        """Test that MongoDB _id is never returned in responses"""
        # Create lecture
        create_response = requests.post(
            f"{BASE_URL}/api/lectures",
            json={"title": "TEST_MongoDB ID Check"}
        )
        assert "_id" not in create_response.json()
        
        # List lectures
        list_response = requests.get(f"{BASE_URL}/api/lectures")
        for lecture in list_response.json():
            assert "_id" not in lecture
        
        # Get single lecture
        lecture_id = create_response.json()["id"]
        get_response = requests.get(f"{BASE_URL}/api/lectures/{lecture_id}")
        assert "_id" not in get_response.json()
        
        print(f"✓ MongoDB _id properly excluded from all responses")


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Cleanup: Delete all lectures with TEST_ prefix
    try:
        response = requests.get(f"{BASE_URL}/api/lectures")
        if response.status_code == 200:
            lectures = response.json()
            for lecture in lectures:
                if lecture["title"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/lectures/{lecture['id']}")
            print(f"\n✓ Cleaned up test data")
    except Exception as e:
        print(f"\n⚠ Cleanup failed: {e}")
