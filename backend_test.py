#!/usr/bin/env python3

import requests
import sys
import json
import io
import tempfile
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List

class WorshipTeamAPITester:
    def __init__(self, base_url="https://churchflow-14.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.auth_token = None
        self.current_user = None
        self.created_resources = {
            "team_members": [],
            "songs": [],
            "services": [],
            "users": []
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None, auth_required: bool = True, files: Dict[str, Any] = None) -> tuple[bool, Dict[Any, Any], int]:
        """Make HTTP request and return success, response data, status code"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = {}
        
        # Add auth token if available and required
        if auth_required and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        
        # Only add Content-Type for JSON requests (not for file uploads)
        if not files:
            headers['Content-Type'] = 'application/json'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers, timeout=10)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {}, 0

            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}

            return response.status_code < 400, response_data, response.status_code

        except Exception as e:
            print(f"Request error: {str(e)}")
            return False, {"error": str(e)}, 0

    def test_login_reliability(self):
        """Test login multiple times to check for intermittent failures"""
        login_data = {
            "email": "n.marrett@hotmail.co.uk",
            "password": "worship2024"
        }
        
        successful_logins = 0
        total_attempts = 5
        
        for i in range(total_attempts):
            success, data, status = self.make_request('POST', '/auth/login', login_data, auth_required=False)
            if success and status == 200 and 'token' in data:
                successful_logins += 1
                if i == 0:  # Keep the first successful token
                    self.auth_token = data['token']
                    self.current_user = data.get('user', {})
        
        return self.log_test(
            "Login reliability (5 attempts)", 
            successful_logins == total_attempts,
            f"Successful: {successful_logins}/{total_attempts}"
        )

    def test_song_file_upload_lyrics(self):
        """Test POST /api/songs/{song_id}/upload with lyrics file"""
        if not self.created_resources["songs"]:
            return self.log_test("Upload lyrics file", False, "No song available for upload")
        
        song_id = self.created_resources["songs"][0]
        
        # Create a test lyrics file
        lyrics_content = "Amazing Grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(lyrics_content)
            temp_file_path = f.name
        
        try:
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('lyrics.txt', f, 'text/plain')}
                data = {'file_type': 'lyrics'}
                
                success, response_data, status = self.make_request('POST', f'/songs/{song_id}/upload', data=data, files=files)
                
                return self.log_test(
                    "Upload lyrics file", 
                    success and status == 200 and 'file_url' in response_data,
                    f"Status: {status}, File URL: {response_data.get('file_url', 'None') if success else 'Failed'}"
                )
        finally:
            os.unlink(temp_file_path)

    def test_song_file_upload_sheet_music(self):
        """Test POST /api/songs/{song_id}/upload with sheet music file"""
        if not self.created_resources["songs"]:
            return self.log_test("Upload sheet music file", False, "No song available for upload")
        
        song_id = self.created_resources["songs"][0]
        
        # Create a minimal JPEG file (1x1 pixel)
        jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9'
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            f.write(jpeg_data)
            temp_file_path = f.name
        
        try:
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('sheet_music.jpg', f, 'image/jpeg')}
                data = {'file_type': 'sheet_music'}
                
                success, response_data, status = self.make_request('POST', f'/songs/{song_id}/upload', data=data, files=files)
                
                return self.log_test(
                    "Upload sheet music file", 
                    success and status == 200 and 'file_url' in response_data,
                    f"Status: {status}, File URL: {response_data.get('file_url', 'None') if success else 'Failed'}"
                )
        finally:
            os.unlink(temp_file_path)

    def test_file_upload_validation_invalid_type(self):
        """Test file upload with invalid file type"""
        if not self.created_resources["songs"]:
            return self.log_test("Upload invalid file type", False, "No song available for upload")
        
        song_id = self.created_resources["songs"][0]
        
        # Try to upload a .txt file as sheet_music (should fail)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This should not be allowed as sheet music")
            temp_file_path = f.name
        
        try:
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('invalid.txt', f, 'text/plain')}
                data = {'file_type': 'sheet_music'}
                
                success, response_data, status = self.make_request('POST', f'/songs/{song_id}/upload', data=data, files=files)
                
                return self.log_test(
                    "Upload invalid file type", 
                    not success and status == 400,
                    f"Status: {status}, Expected 400 for invalid file type"
                )
        finally:
            os.unlink(temp_file_path)

    def test_file_upload_validation_large_file(self):
        """Test file upload with file larger than 5MB"""
        if not self.created_resources["songs"]:
            return self.log_test("Upload large file", False, "No song available for upload")
        
        song_id = self.created_resources["songs"][0]
        
        # Create a file larger than 5MB
        large_content = "A" * (6 * 1024 * 1024)  # 6MB
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(large_content)
            temp_file_path = f.name
        
        try:
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('large_lyrics.txt', f, 'text/plain')}
                data = {'file_type': 'lyrics'}
                
                success, response_data, status = self.make_request('POST', f'/songs/{song_id}/upload', data=data, files=files)
                
                return self.log_test(
                    "Upload large file (>5MB)", 
                    not success and status == 400,
                    f"Status: {status}, Expected 400 for file too large"
                )
        finally:
            os.unlink(temp_file_path)

    def test_uploaded_file_access(self):
        """Test accessing uploaded files via /api/uploads/{filename}"""
        if not self.created_resources["songs"]:
            return self.log_test("Access uploaded file", False, "No song available")
        
        song_id = self.created_resources["songs"][0]
        
        # First get the song to check if it has uploaded files
        success, song_data, status = self.make_request('GET', f'/songs/{song_id}')
        if not success:
            return self.log_test("Access uploaded file", False, "Could not retrieve song data")
        
        file_url = song_data.get('lyrics_file') or song_data.get('sheet_music_file')
        if not file_url:
            return self.log_test("Access uploaded file", False, "No uploaded files found")
        
        # Extract filename from URL
        filename = file_url.split('/')[-1]
        
        # Try to access the file
        success, data, status = self.make_request('GET', f'/uploads/{filename}', auth_required=False)
        
        return self.log_test(
            "Access uploaded file", 
            success and status == 200,
            f"Status: {status}, File: {filename}"
        )

    def test_delete_song_file_lyrics(self):
        """Test DELETE /api/songs/{song_id}/file/lyrics"""
        if not self.created_resources["songs"]:
            return self.log_test("Delete lyrics file", False, "No song available")
        
        song_id = self.created_resources["songs"][0]
        
        success, response_data, status = self.make_request('DELETE', f'/songs/{song_id}/file/lyrics')
        
        return self.log_test(
            "Delete lyrics file", 
            success and status == 200,
            f"Status: {status}, Message: {response_data.get('message', 'None') if success else 'Failed'}"
        )

    def test_delete_song_file_sheet_music(self):
        """Test DELETE /api/songs/{song_id}/file/sheet_music"""
        if not self.created_resources["songs"]:
            return self.log_test("Delete sheet music file", False, "No song available")
        
        song_id = self.created_resources["songs"][0]
        
        success, response_data, status = self.make_request('DELETE', f'/songs/{song_id}/file/sheet_music')
        
        return self.log_test(
            "Delete sheet music file", 
            success and status == 200,
            f"Status: {status}, Message: {response_data.get('message', 'None') if success else 'Failed'}"
        )

    def test_root_endpoint(self):
        """Test GET /api/"""
        success, data, status = self.make_request('GET', '/', auth_required=False)
        return self.log_test(
            "Root endpoint", 
            success and status == 200,
            f"Status: {status}, Response: {data.get('message', 'No message')}"
        )

    # Authentication Tests
    def test_login_master_admin(self):
        """Test login with master admin credentials"""
        login_data = {
            "email": "n.marrett@hotmail.co.uk",
            "password": "worship2024"
        }
        
        success, data, status = self.make_request('POST', '/auth/login', login_data, auth_required=False)
        
        if success and status == 200 and 'token' in data:
            self.auth_token = data['token']
            self.current_user = data.get('user', {})
            
        return self.log_test(
            "Master Admin Login", 
            success and status == 200 and 'token' in data,
            f"Status: {status}, User: {data.get('user', {}).get('name', 'Unknown') if success else 'Failed'}"
        )

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        login_data = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        
        success, data, status = self.make_request('POST', '/auth/login', login_data, auth_required=False)
        
        return self.log_test(
            "Invalid Login", 
            not success and status == 401,
            f"Status: {status}, Expected 401 for invalid credentials"
        )

    def test_get_current_user(self):
        """Test GET /api/auth/me"""
        if not self.auth_token:
            return self.log_test("Get current user", False, "No auth token available")
            
        success, data, status = self.make_request('GET', '/auth/me')
        
        return self.log_test(
            "Get current user", 
            success and status == 200 and 'email' in data,
            f"Status: {status}, User: {data.get('name', 'Unknown') if success else 'Failed'}"
        )

    def test_get_users_master_admin(self):
        """Test GET /api/users (Master Admin only)"""
        if not self.auth_token:
            return self.log_test("Get users", False, "No auth token available")
            
        success, data, status = self.make_request('GET', '/users')
        is_list = isinstance(data, list) if success else False
        
        return self.log_test(
            "Get users (Master Admin)", 
            success and status == 200 and is_list,
            f"Status: {status}, Users count: {len(data) if is_list else 'Not a list'}"
        )

    def test_create_new_user(self):
        """Test POST /api/auth/register (Master Admin only)"""
        if not self.auth_token:
            return self.log_test("Create new user", False, "No auth token available")
            
        test_user = {
            "email": f"test.user.{datetime.now().strftime('%H%M%S')}@example.com",
            "name": "Test User",
            "password": "testpass123",
            "role": "member"
        }
        
        success, data, status = self.make_request('POST', '/auth/register', test_user)
        
        if success and status == 200:
            self.created_resources["users"].append(data.get('id'))
            
        return self.log_test(
            "Create new user", 
            success and status == 200 and 'id' in data,
            f"Status: {status}, Created user: {data.get('name', 'Unknown') if success else 'Failed'}"
        )

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without auth"""
        # Temporarily remove auth token
        temp_token = self.auth_token
        self.auth_token = None
        
        success, data, status = self.make_request('GET', '/users')
        
        # Restore auth token
        self.auth_token = temp_token
        
        return self.log_test(
            "Unauthorized access", 
            not success and status == 401,
            f"Status: {status}, Expected 401 for unauthorized access"
        )

    def test_stats_endpoint(self):
        """Test GET /api/stats"""
        success, data, status = self.make_request('GET', '/stats')
        expected_keys = ['team_members', 'songs', 'total_services', 'upcoming_services']
        has_all_keys = all(key in data for key in expected_keys) if success else False
        
        return self.log_test(
            "Stats endpoint", 
            success and status == 200 and has_all_keys,
            f"Status: {status}, Keys: {list(data.keys()) if success else 'None'}"
        )

    def test_create_team_member(self):
        """Test POST /api/team-members"""
        test_member = {
            "name": "Test Singer",
            "email": "test@example.com",
            "phone": "123-456-7890",
            "roles": ["singer", "guitarist"],
            "notes": "Test member for API testing"
        }
        
        success, data, status = self.make_request('POST', '/team-members', test_member)
        
        if success and status == 200:
            self.created_resources["team_members"].append(data.get('id'))
            
        return self.log_test(
            "Create team member", 
            success and status == 200 and 'id' in data,
            f"Status: {status}, Created ID: {data.get('id', 'None')}"
        )

    def test_get_team_members(self):
        """Test GET /api/team-members"""
        success, data, status = self.make_request('GET', '/team-members')
        is_list = isinstance(data, list) if success else False
        
        return self.log_test(
            "Get team members", 
            success and status == 200 and is_list,
            f"Status: {status}, Count: {len(data) if is_list else 'Not a list'}"
        )

    def test_update_team_member(self):
        """Test PUT /api/team-members/{id}"""
        if not self.created_resources["team_members"]:
            return self.log_test("Update team member", False, "No team member to update")
        
        member_id = self.created_resources["team_members"][0]
        update_data = {"notes": "Updated notes for testing"}
        
        success, data, status = self.make_request('PUT', f'/team-members/{member_id}', update_data)
        
        return self.log_test(
            "Update team member", 
            success and status == 200,
            f"Status: {status}, Updated: {data.get('notes', 'No notes') if success else 'Failed'}"
        )

    def test_create_song(self):
        """Test POST /api/songs"""
        test_song = {
            "title": "Test Song",
            "artist": "Test Artist",
            "key": "C",
            "tempo": 120,
            "notes": "Test song for API testing"
        }
        
        success, data, status = self.make_request('POST', '/songs', test_song)
        
        if success and status == 200:
            self.created_resources["songs"].append(data.get('id'))
            
        return self.log_test(
            "Create song", 
            success and status == 200 and 'id' in data,
            f"Status: {status}, Created ID: {data.get('id', 'None')}"
        )

    def test_get_songs(self):
        """Test GET /api/songs"""
        success, data, status = self.make_request('GET', '/songs')
        is_list = isinstance(data, list) if success else False
        
        return self.log_test(
            "Get songs", 
            success and status == 200 and is_list,
            f"Status: {status}, Count: {len(data) if is_list else 'Not a list'}"
        )

    def test_update_song(self):
        """Test PUT /api/songs/{id}"""
        if not self.created_resources["songs"]:
            return self.log_test("Update song", False, "No song to update")
        
        song_id = self.created_resources["songs"][0]
        update_data = {"tempo": 140}
        
        success, data, status = self.make_request('PUT', f'/songs/{song_id}', update_data)
        
        return self.log_test(
            "Update song", 
            success and status == 200,
            f"Status: {status}, Updated tempo: {data.get('tempo', 'No tempo') if success else 'Failed'}"
        )

    def test_create_service(self):
        """Test POST /api/services"""
        future_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        test_service = {
            "date": future_date,
            "day": "Sunday",
            "time": "10:00 AM",
            "title": "Test Service",
            "notes": "Test service for API testing"
        }
        
        success, data, status = self.make_request('POST', '/services', test_service)
        
        if success and status == 200:
            self.created_resources["services"].append(data.get('id'))
            
        return self.log_test(
            "Create service", 
            success and status == 200 and 'id' in data,
            f"Status: {status}, Created ID: {data.get('id', 'None')}"
        )

    def test_get_services(self):
        """Test GET /api/services"""
        success, data, status = self.make_request('GET', '/services')
        is_list = isinstance(data, list) if success else False
        
        return self.log_test(
            "Get services", 
            success and status == 200 and is_list,
            f"Status: {status}, Count: {len(data) if is_list else 'Not a list'}"
        )

    def test_get_upcoming_services(self):
        """Test GET /api/services/upcoming/list"""
        success, data, status = self.make_request('GET', '/services/upcoming/list')
        is_list = isinstance(data, list) if success else False
        
        return self.log_test(
            "Get upcoming services", 
            success and status == 200 and is_list,
            f"Status: {status}, Count: {len(data) if is_list else 'Not a list'}"
        )

    def test_update_service(self):
        """Test PUT /api/services/{id}"""
        if not self.created_resources["services"]:
            return self.log_test("Update service", False, "No service to update")
        
        service_id = self.created_resources["services"][0]
        
        # Create assignments and song slots for testing
        assignments = []
        song_slots = []
        
        if self.created_resources["team_members"]:
            assignments.append({
                "member_id": self.created_resources["team_members"][0],
                "member_name": "Test Singer",
                "role": "singer"
            })
        
        if self.created_resources["songs"]:
            song_slots.append({
                "song_id": self.created_resources["songs"][0],
                "song_title": "Test Song",
                "order": 1
            })
        
        update_data = {
            "title": "Updated Test Service",
            "assignments": assignments,
            "song_slots": song_slots
        }
        
        success, data, status = self.make_request('PUT', f'/services/{service_id}', update_data)
        
        return self.log_test(
            "Update service with assignments", 
            success and status == 200,
            f"Status: {status}, Assignments: {len(data.get('assignments', [])) if success else 0}, Songs: {len(data.get('song_slots', [])) if success else 0}"
        )

    def test_delete_operations(self):
        """Test DELETE operations for cleanup"""
        delete_results = []
        
        # Delete services
        for service_id in self.created_resources["services"]:
            success, data, status = self.make_request('DELETE', f'/services/{service_id}')
            delete_results.append(self.log_test(f"Delete service {service_id}", success and status == 200, f"Status: {status}"))
        
        # Delete songs
        for song_id in self.created_resources["songs"]:
            success, data, status = self.make_request('DELETE', f'/songs/{song_id}')
            delete_results.append(self.log_test(f"Delete song {song_id}", success and status == 200, f"Status: {status}"))
        
        # Delete team members
        for member_id in self.created_resources["team_members"]:
            success, data, status = self.make_request('DELETE', f'/team-members/{member_id}')
            delete_results.append(self.log_test(f"Delete team member {member_id}", success and status == 200, f"Status: {status}"))
        
        # Delete users (except master admin)
        for user_id in self.created_resources["users"]:
            success, data, status = self.make_request('DELETE', f'/users/{user_id}')
            delete_results.append(self.log_test(f"Delete user {user_id}", success and status == 200, f"Status: {status}"))
        
        return all(delete_results)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Worship Team Database API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Basic endpoint tests
        self.test_root_endpoint()
        
        # Authentication tests
        print("\n🔐 Authentication Tests:")
        self.test_login_master_admin()
        self.test_login_reliability()  # Test login multiple times
        self.test_login_invalid_credentials()
        self.test_get_current_user()
        self.test_get_users_master_admin()
        self.test_create_new_user()
        self.test_unauthorized_access()
        
        # Protected endpoint tests (require authentication)
        print("\n📊 Protected Endpoint Tests:")
        self.test_stats_endpoint()
        
        # Team member tests
        print("\n👥 Team Member Tests:")
        self.test_create_team_member()
        self.test_get_team_members()
        self.test_update_team_member()
        
        # Song tests
        print("\n🎵 Song Tests:")
        self.test_create_song()
        self.test_get_songs()
        self.test_update_song()
        
        # File upload tests
        print("\n📁 File Upload Tests:")
        self.test_song_file_upload_lyrics()
        self.test_song_file_upload_sheet_music()
        self.test_uploaded_file_access()
        self.test_file_upload_validation_invalid_type()
        self.test_file_upload_validation_large_file()
        self.test_delete_song_file_lyrics()
        self.test_delete_song_file_sheet_music()
        
        # Service tests
        print("\n📅 Service Tests:")
        self.test_create_service()
        self.test_get_services()
        self.test_get_upcoming_services()
        self.test_update_service()
        
        # Cleanup tests
        print("\n🧹 Cleanup Tests:")
        self.test_delete_operations()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = WorshipTeamAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())