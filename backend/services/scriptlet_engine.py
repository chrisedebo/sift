import sys
import os
import subprocess
import tempfile
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("sift.scriptlet_engine")

def execute_python_scriptlet(script_code: str, timeout_seconds: int = 15) -> Dict[str, Any]:
    """
    Safely executes a Python scriptlet in a isolated subprocess with timeout guardrails.
    Returns stdout, stderr, exit_code, and execution details.
    """
    logger.info("Executing user/AI Python scriptlet (timeout=%ds)...", timeout_seconds)
    
    # Write code to temporary file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tmp_file:
        tmp_file.write(script_code)
        tmp_script_path = tmp_file.name

    try:
        # Run subprocess with python interpreter
        result = subprocess.run(
            [sys.executable, tmp_script_path],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd="/app" if os.path.exists("/app") else os.getcwd()
        )

        stdout = result.stdout
        stderr = result.stderr
        exit_code = result.returncode

        logger.info("Scriptlet execution finished with exit_code=%d", exit_code)
        return {
            "status": "success" if exit_code == 0 else "error",
            "exit_code": exit_code,
            "stdout": stdout.strip(),
            "stderr": stderr.strip(),
            "script_code": script_code
        }

    except subprocess.TimeoutExpired:
        logger.error("Scriptlet execution timed out after %d seconds", timeout_seconds)
        return {
            "status": "timeout",
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Execution timed out after {timeout_seconds} seconds.",
            "script_code": script_code
        }
    except Exception as e:
        logger.error("Scriptlet execution failed: %s", str(e), exc_info=True)
        return {
            "status": "error",
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "script_code": script_code
        }
    finally:
        if os.path.exists(tmp_script_path):
            try:
                os.remove(tmp_script_path)
            except OSError:
                pass
