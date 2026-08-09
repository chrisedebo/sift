import pytest
import httpx
from unittest.mock import MagicMock
from services.searxng import SearXNGService
from db.models import SearxCache

@pytest.fixture
def service():
    return SearXNGService(base_url="http://dummy-searxng")

@pytest.fixture
def mock_db(mocker):
    db = mocker.MagicMock()
    # Mock the query chain
    db.query.return_value.filter.return_value.first.return_value = None
    return db

@pytest.mark.asyncio
async def test_check_health_success(service, mocker):
    mock_res = mocker.Mock()
    mock_res.status_code = 200
    mocker.patch("httpx.AsyncClient.get", return_value=mock_res)
    
    result = await service.check_health()
    assert result["status"] == "healthy"
    assert result["endpoint"] == "http://dummy-searxng"

@pytest.mark.asyncio
async def test_check_health_degraded(service, mocker):
    mock_res = mocker.Mock()
    mock_res.status_code = 502
    mock_res.text = "Bad Gateway"
    mocker.patch("httpx.AsyncClient.get", return_value=mock_res)
    
    result = await service.check_health()
    assert result["status"] == "degraded"
    assert "HTTP 502" in result["error"]

@pytest.mark.asyncio
async def test_check_health_unreachable(service, mocker):
    mocker.patch("httpx.AsyncClient.get", side_effect=httpx.RequestError("No route to host"))
    
    result = await service.check_health()
    assert result["status"] == "unreachable"
    assert "No route to host" in result["error"]

@pytest.mark.asyncio
async def test_search_empty_query(service):
    result = await service.search("   ")
    assert result == []

@pytest.mark.asyncio
async def test_search_cache_hit(service, mock_db):
    cached_entry = SearxCache(query="test", results_json='[{"title": "Test Title", "url": "http://test", "snippet": "Snippet"}]')
    mock_db.query.return_value.filter.return_value.first.return_value = cached_entry
    
    result = await service.search("test", db=mock_db)
    
    assert len(result) == 1
    assert result[0]["title"] == "Test Title"

@pytest.mark.asyncio
async def test_search_success_and_cache_store(service, mock_db, mocker):
    # Mock HTTP response
    mock_res = mocker.Mock()
    mock_res.status_code = 200
    mock_res.json.return_value = {
        "results": [
            {"title": "HTTP Title", "url": "http://example.com", "content": "Content string"},
            {"title": "HTTP Title 2", "url": "http://example.org", "snippet": "Snippet string"}
        ]
    }
    mocker.patch("httpx.AsyncClient.get", return_value=mock_res)
    
    result = await service.search("new query", db=mock_db, max_results=2)
    
    assert len(result) == 2
    assert result[0]["title"] == "HTTP Title"
    assert result[0]["snippet"] == "Content string"
    assert result[1]["snippet"] == "Snippet string"
    
    # Assert DB add and commit were called to store cache
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()

@pytest.mark.asyncio
async def test_search_request_error(service, mock_db, mocker):
    mocker.patch("httpx.AsyncClient.get", side_effect=httpx.RequestError("Network dropped"))
    
    result = await service.search("broken query", db=mock_db)
    
    assert result == []
