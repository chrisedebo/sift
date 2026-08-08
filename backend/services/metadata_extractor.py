import os
import logging
from typing import Dict, Any
from PIL import Image
from PIL.ExifTags import TAGS
from tinytag import TinyTag

logger = logging.getLogger("sift.metadata")

def make_json_safe(obj: Any) -> Any:
    """Recursively converts EXIF IFDRational, bytes, datetimes, and tuples into 100% JSON-safe types."""
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    elif isinstance(obj, (list, tuple)):
        return [make_json_safe(item) for item in obj]
    elif isinstance(obj, dict):
        return {str(k): make_json_safe(v) for k, v in obj.items()}
    elif isinstance(obj, bytes):
        try:
            return obj.decode("utf-8", errors="ignore")
        except Exception:
            return str(obj)
    else:
        return str(obj)

def extract_file_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extracts deep technical, embedded ID3, EXIF, and media metadata from files on disk.
    Supports audio (FLAC, MP3, WAV, AAC, OGG), images (JPG, PNG, WEBP), and general files.
    Always returns a 100% JSON-serializable dictionary.
    """
    metadata: Dict[str, Any] = {
        "file_exists": False,
        "file_size": 0,
        "media_type": "unknown",
        "embedded_tags": {},
        "exif_data": {},
        "image_info": {}
    }

    if not os.path.exists(file_path):
        logger.warning("File path does not exist for metadata extraction: %s", file_path)
        return metadata

    metadata["file_exists"] = True
    metadata["file_size"] = os.path.getsize(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    # 1. AUDIO METADATA EXTRACTION (FLAC, MP3, WAV, AAC, M4A, OGG)
    if ext in ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.aac', '.wma', '.aiff']:
        metadata["media_type"] = "audio"
        try:
            tag = TinyTag.get(file_path)
            metadata["embedded_tags"] = {
                "title": tag.title,
                "artist": tag.artist,
                "album": tag.album,
                "albumartist": tag.albumartist,
                "year": tag.year,
                "genre": tag.genre,
                "track": tag.track,
                "track_total": tag.track_total,
                "disc": tag.disc,
                "duration_seconds": round(tag.duration, 2) if tag.duration else None,
                "bitrate_kbps": round(tag.bitrate, 1) if tag.bitrate else None,
                "samplerate_hz": tag.samplerate,
                "composer": getattr(tag, 'composer', None),
                "comment": tag.comment
            }
            # Strip null entries
            metadata["embedded_tags"] = {k: v for k, v in metadata["embedded_tags"].items() if v is not None}
        except Exception as e:
            logger.debug("TinyTag failed for %s: %s", file_path, str(e))

    # 2. IMAGE METADATA & EXIF EXTRACTION (JPG, PNG, WEBP, TIFF)
    elif ext in ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp']:
        metadata["media_type"] = "image"
        try:
            with Image.open(file_path) as img:
                metadata["image_info"] = {
                    "width": img.width,
                    "height": img.height,
                    "format": img.format,
                    "mode": img.mode,
                }
                
                # Extract EXIF if present
                exif_raw = img._getexif() if hasattr(img, '_getexif') else None
                if exif_raw:
                    for tag_id, value in exif_raw.items():
                        tag_name = TAGS.get(tag_id, str(tag_id))
                        metadata["exif_data"][tag_name] = make_json_safe(value)
        except Exception as e:
            logger.debug("Image EXIF extraction failed for %s: %s", file_path, str(e))

    # 3. VIDEO METADATA (MP4, MKV, AVI, MOV)
    elif ext in ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm']:
        metadata["media_type"] = "video"
        try:
            tag = TinyTag.get(file_path)
            metadata["embedded_tags"] = {
                "title": tag.title,
                "duration_seconds": round(tag.duration, 2) if tag.duration else None,
                "bitrate_kbps": round(tag.bitrate, 1) if tag.bitrate else None,
            }
            metadata["embedded_tags"] = {k: v for k, v in metadata["embedded_tags"].items() if v is not None}
        except Exception as e:
            logger.debug("Video header tag extraction failed for %s: %s", file_path, str(e))

    return make_json_safe(metadata)
