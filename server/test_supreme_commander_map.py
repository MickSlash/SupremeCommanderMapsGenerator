import os
import shutil
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from supremeCommanderMap import (
    app,
    extract_directory_maps,
    find_preview_image,
    run_java_program,
    zip_map_directory,
)


class TestSupremeCommanderMap(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_index_get(self):
        """GET / should return online service status"""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "online")

    def test_validation_invalid_player_count(self):
        """Validation should reject player counts outside allowed range"""
        response = self.app.post('/', data={'maxPlayer': '99', 'mapNumber': '1', 'mapSize': '512'})
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())

    def test_validation_invalid_map_number(self):
        """Validation should reject map numbers over the limit"""
        response = self.app.post('/', data={'maxPlayer': '6', 'mapNumber': '20', 'mapSize': '512'})
        self.assertEqual(response.status_code, 400)

    def test_extract_directory_maps(self):
        """Should extract directory paths from Java CLI stdout"""
        output = (
            "Starting pipeline\n"
            "Saving map to C:\\Games\\Maps\\neroxis_map_1\\\n"
            "Saving map to C:\\Games\\Maps\\neroxis_map_2\\\n"
        )
        expected = [
            "C:\\Games\\Maps\\neroxis_map_1\\",
            "C:\\Games\\Maps\\neroxis_map_2\\",
        ]
        self.assertEqual(extract_directory_maps(output), expected)

    def test_find_preview_image(self):
        """Should discover PNG file inside map directory"""
        png_file = os.path.join(self.temp_dir, "map_preview.png")
        with open(png_file, "w") as f:
            f.write("fake image data")
        self.assertEqual(find_preview_image(self.temp_dir), png_file)

    def test_zip_map_directory(self):
        """Should create a valid zip archive with directory contents"""
        sub_dir = os.path.join(self.temp_dir, "sample_map")
        os.makedirs(sub_dir, exist_ok=True)
        sample_file = os.path.join(sub_dir, "sample.scmap")
        with open(sample_file, "w") as f:
            f.write("map binary content")

        target_zip_dir = os.path.join(self.temp_dir, "zips")
        zip_path = zip_map_directory(sub_dir, "sample_map", target_zip_dir)

        self.assertTrue(os.path.isfile(zip_path))
        self.assertTrue(zip_path.endswith(".zip"))

    @patch("subprocess.run")
    def test_run_java_program_mocked(self, mock_subprocess):
        """Should execute subprocess.run with secure argument list"""
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_process.stdout = "Saving map to /tmp/map1"
        mock_process.stderr = ""
        mock_subprocess.return_value = mock_process

        stdout, success = run_java_program(
            max_players=4,
            map_number=1,
            map_size=512,
            output_dir="/tmp/out",
            style="LAND_BRIDGE"
        )

        self.assertTrue(success)
        self.assertEqual(stdout, "Saving map to /tmp/map1")
        # Verify shell=False is used (default in subprocess.run)
        called_kwargs = mock_subprocess.call_args.kwargs
        self.assertFalse(called_kwargs.get("shell", False))


if __name__ == '__main__':
    unittest.main()
