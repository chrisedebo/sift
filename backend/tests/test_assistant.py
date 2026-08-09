import pytest
from unittest.mock import MagicMock
from db.models import FileRecord
from services.assistant import answer_assistant_query, encode_image_base64
from services.tools import FileCategoryEnum

def test_encode_image_base64_not_exists(mocker):
    mocker.patch("os.path.exists", return_value=False)
    assert encode_image_base64("dummy.jpg") is None

def test_encode_image_base64_too_large(mocker):
    mocker.patch("os.path.exists", return_value=True)
    mocker.patch("os.path.getsize", return_value=10 * 1024 * 1024) # 10MB
    assert encode_image_base64("dummy.jpg") is None

def test_encode_image_base64_success(mocker):
    mocker.patch("os.path.exists", return_value=True)
    mocker.patch("os.path.getsize", return_value=1 * 1024 * 1024) # 1MB
    mocker.patch("builtins.open", mocker.mock_open(read_data=b"test data"))
    result = encode_image_base64("dummy.jpg")
    assert result == "dGVzdCBkYXRh" # base64 of "test data"

@pytest.fixture
def mock_db(mocker):
    db = mocker.MagicMock()
    return db

@pytest.fixture
def mock_files():
    return [
        FileRecord(id=1, filename="test_song.mp3", extension=".mp3", file_size=1024, category="Media", file_path="/mnt/big-storage/test_song.mp3", status="indexed"),
        FileRecord(id=2, filename="test_image.jpg", extension=".jpg", file_size=2048, category="Media", file_path="/mnt/big-storage/test_image.jpg", status="indexed")
    ]

@pytest.mark.asyncio
async def test_answer_assistant_query_db_search(mock_db, mock_files, mocker):
    mocker.patch("services.assistant.tool_search_files", return_value={"count": 1, "files": [{"id": 1, "filename": "test_song.mp3", "file_path": "/path", "file_size": 123, "category": "Media", "status": "indexed"}]})
    mocker.patch("services.assistant.extract_file_metadata", return_value={})
    mocker.patch("services.assistant.searx_client.search", return_value=[])
    mocker.patch("services.assistant.llm_client.generate_completion", return_value="Here is the DB search result.")
    
    mock_db.query.return_value.all.return_value = mock_files
    
    result = await answer_assistant_query("find flac files", mock_db)
    assert result["status"] == "success"
    assert result["answer"] == "Here is the DB search result."
    # Since "flac" matches the extension logic, tool_search_files should be called
    import services.assistant
    services.assistant.tool_search_files.assert_called_once()
    
@pytest.mark.asyncio
async def test_answer_assistant_query_with_target_files(mock_db, mock_files, mocker):
    mocker.patch("services.assistant.extract_file_metadata", return_value={"embedded_tags": {"Artist": "Test"}})
    mocker.patch("services.assistant.searx_client.search", return_value=[{"title": "Web", "snippet": "Search result"}])
    mocker.patch("services.assistant.llm_client.generate_completion", return_value="Here is info about the song.")
    mocker.patch("services.assistant.encode_image_base64", return_value="base64str")
    
    # Return mock files when querying by ID
    mock_db.query.return_value.filter.return_value.all.return_value = mock_files
    
    history = [{"role": "user", "content": "previous query"}]
    
    result = await answer_assistant_query("What album is this song?", mock_db, target_file_ids=[1, 2], history=history)
    
    assert result["status"] == "success"
    assert result["answer"] == "Here is info about the song."
    assert result["target_files_count"] == 2
    assert "test_song.mp3" in result["target_files"]

@pytest.mark.asyncio
async def test_answer_assistant_query_llm_error(mock_db, mocker):
    mocker.patch("services.assistant.tool_search_files", return_value={})
    mocker.patch("services.assistant.llm_client.generate_completion", side_effect=Exception("LLM Down"))
    mock_db.query.return_value.all.return_value = []
    
    result = await answer_assistant_query("Hello", mock_db)
    
    assert result["status"] == "error"
    assert "LLM Down" in result["answer"]
