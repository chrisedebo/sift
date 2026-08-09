import pytest
import httpx
from unittest.mock import AsyncMock, patch

from services.llm_provider import LLMProvider

@pytest.fixture
def provider():
    # Provide dummy configuration
    return LLMProvider(base_url="http://dummy-llm", api_key="dummy-key", model="dummy-model")

@pytest.mark.asyncio
async def test_check_health_success(provider, mocker):
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"data": [{"id": "model-1"}, {"id": "model-2"}]}
    
    # Mock httpx.AsyncClient.get
    mocker.patch("httpx.AsyncClient.get", return_value=mock_response)
    
    result = await provider.check_health()
    
    assert result["status"] == "healthy"
    assert result["endpoint"] == "http://dummy-llm"
    assert "model-1" in result["available_models"]
    assert "model-2" in result["available_models"]

@pytest.mark.asyncio
async def test_check_health_degraded(provider, mocker):
    mock_response = mocker.Mock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    
    mocker.patch("httpx.AsyncClient.get", return_value=mock_response)
    
    result = await provider.check_health()
    
    assert result["status"] == "degraded"
    assert result["endpoint"] == "http://dummy-llm"
    assert "HTTP 500" in result["error"]

@pytest.mark.asyncio
async def test_check_health_unreachable(provider, mocker):
    mocker.patch("httpx.AsyncClient.get", side_effect=httpx.RequestError("Connection failed"))
    
    result = await provider.check_health()
    
    assert result["status"] == "unreachable"
    assert "Connection failed" in result["error"]

@pytest.mark.asyncio
async def test_generate_completion_success(provider, mocker):
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [
            {"message": {"content": "Hello, world!"}}
        ]
    }
    
    mocker.patch("httpx.AsyncClient.post", return_value=mock_response)
    
    messages = [{"role": "user", "content": "Hi"}]
    result = await provider.generate_completion(messages)
    
    assert result == "Hello, world!"

@pytest.mark.asyncio
async def test_generate_completion_empty_choices(provider, mocker):
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": []}
    
    mocker.patch("httpx.AsyncClient.post", return_value=mock_response)
    
    messages = [{"role": "user", "content": "Hi"}]
    with pytest.raises(ValueError, match="No choices returned from LLM completion"):
        await provider.generate_completion(messages)

@pytest.mark.asyncio
async def test_generate_completion_timeout(provider, mocker):
    mocker.patch("httpx.AsyncClient.post", side_effect=httpx.ReadTimeout("Timeout"))
    
    messages = [{"role": "user", "content": "Hi"}]
    with pytest.raises(TimeoutError, match="LM Studio local model generation timed out"):
        await provider.generate_completion(messages)

@pytest.mark.asyncio
async def test_generate_completion_request_error(provider, mocker):
    mocker.patch("httpx.AsyncClient.post", side_effect=httpx.RequestError("Network error"))
    
    messages = [{"role": "user", "content": "Hi"}]
    with pytest.raises(RuntimeError, match="LLM request failed"):
        await provider.generate_completion(messages)
