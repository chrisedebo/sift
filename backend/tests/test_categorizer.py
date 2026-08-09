import json
import pytest
from unittest.mock import MagicMock
from db.models import FileRecord, ActionItem
from services.categorizer import clean_json_response, categorize_and_enrich_file

def test_clean_json_response():
    # Test valid json without markdown
    assert clean_json_response('{"test": 1}') == '{"test": 1}'
    
    # Test markdown code block
    markdown = """```json
{"test": 1}
```"""
    assert clean_json_response(markdown) == '{"test": 1}'
    
    # Test generic code block
    markdown_generic = """```
{"category": "Media"}
```"""
    assert clean_json_response(markdown_generic) == '{"category": "Media"}'

@pytest.fixture
def mock_file_record():
    record = FileRecord(
        id=1,
        filename="test_video.mp4",
        extension=".mp4",
        file_size=1024,
        mime_type="video/mp4",
        file_path="/mnt/big-storage/test_video.mp4",
        category=None,
        status="indexed"
    )
    return record

@pytest.fixture
def mock_db(mocker):
    db = mocker.MagicMock()
    # Mock existing ActionItem query returning None
    db.query.return_value.filter.return_value.first.return_value = None
    return db

@pytest.mark.asyncio
async def test_categorize_and_enrich_file_success(mock_file_record, mock_db, mocker):
    mocker.patch("services.categorizer.extract_file_metadata", return_value={"image_info": {}})
    mocker.patch("services.categorizer.searx_client.search", return_value=[{"title": "test", "snippet": "test"}])
    
    mock_llm_response = """```json
{
  "category": "Media",
  "summary": "A test video file.",
  "tags": ["video"],
  "proposed_folder": "Media/Videos",
  "proposed_filename": "clean_video.mp4",
  "reasoning": "Standard video file"
}
```"""
    mocker.patch("services.categorizer.llm_client.generate_completion", return_value=mock_llm_response)
    
    result = await categorize_and_enrich_file(mock_file_record, mock_db)
    
    assert result["category"] == "Media"
    assert result["summary"] == "A test video file."
    assert "Media/Videos/clean_video.mp4" in result["proposed_target_path"]
    
    # Check that it saves to the db
    assert mock_file_record.category == "Media"
    assert mock_file_record.status == "action_pending"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called()

@pytest.mark.asyncio
async def test_categorize_and_enrich_file_searxng_failure(mock_file_record, mock_db, mocker):
    mocker.patch("services.categorizer.extract_file_metadata", return_value=None)
    mocker.patch("services.categorizer.searx_client.search", side_effect=Exception("SearXNG down"))
    
    mock_llm_response = '{"category": "Documents", "proposed_folder": "Documents/Test"}'
    mocker.patch("services.categorizer.llm_client.generate_completion", return_value=mock_llm_response)
    
    result = await categorize_and_enrich_file(mock_file_record, mock_db)
    
    assert result["category"] == "Documents"
    assert "Documents/Test" in result["proposed_target_path"]

@pytest.mark.asyncio
async def test_categorize_and_enrich_file_llm_failure(mock_file_record, mock_db, mocker):
    mocker.patch("services.categorizer.extract_file_metadata", return_value=None)
    mocker.patch("services.categorizer.searx_client.search", return_value=[])
    mocker.patch("services.categorizer.llm_client.generate_completion", side_effect=Exception("LLM Down"))
    
    with pytest.raises(Exception, match="LLM Down"):
        await categorize_and_enrich_file(mock_file_record, mock_db)
        
    assert mock_file_record.status == "categorized"
    mock_db.rollback.assert_called_once()
