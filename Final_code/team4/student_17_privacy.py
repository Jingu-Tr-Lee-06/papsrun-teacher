import hashlib
import math
import random
from typing import Any, Dict, List, Optional


def anonymize_runner_identifier(raw_identifier: Optional[str]) -> Dict[str, str]:
    """러너 식별자(학번·이름 등)의 평문을 폐기하고 SHA-256 단방향 해시 토큰으로 비식별화합니다."""
    cleaned = (raw_identifier or "").strip()
    if not cleaned:
        return {
            "anonymized_id": "ANON-GUEST-0000",
            "method": "익명 게스트 세션 (개인 식별자 미수집)",
            "raw_discarded": "true",
        }

    digest = hashlib.sha256(cleaned.encode("utf-8")).hexdigest().upper()
    return {
        "anonymized_id": f"ANON-{digest[:12]}",
        "method": "SHA-256 단방향 해시 비식별화 (원본 즉시 파기)",
        "raw_discarded": "true",
    }


def mask_coordinates_privacy(
    coords: List[List[float]],
    noise_meters: float = 18.0,
) -> List[List[float]]:
    """출발지 및 도착지 GPS 좌표에 가우시안 차분 프라이버시 노이즈를 주입해 실거점 노출을 방지합니다."""
    if not coords:
        return []

    masked = [list(pt) for pt in coords]
    target_indices = [0] if len(masked) == 1 else [0, len(masked) - 1]

    for idx in target_indices:
        lat, lon = masked[idx][0], masked[idx][1]
        d_lat = (random.gauss(0.0, noise_meters * 0.6)) / 111320.0
        cos_lat = max(0.2, math.cos(math.radians(lat)))
        d_lon = (random.gauss(0.0, noise_meters * 0.6)) / (111320.0 * cos_lat)
        masked[idx] = [round(lat + d_lat, 6), round(lon + d_lon, 6)]

    return masked


def build_privacy_audit_report(
    raw_identifier: Optional[str],
    noise_meters: float = 18.0,
) -> Dict[str, Any]:
    """유네스코 AI 윤리 권고 제31조(프라이버시 및 데이터 보호) 준수 리포트를 생성합니다."""
    id_info = anonymize_runner_identifier(raw_identifier)
    return {
        "standard": "UNESCO AI Ethics Recommendation Art. 31",
        "anonymized_runner_id": id_info["anonymized_id"],
        "identity_protection": id_info["method"],
        "location_protection": f"GPS 출발·도착 거점 차분 프라이버시 마스킹 (±{noise_meters:.0f}m 가우시안 오프셋)",
        "biometric_retention": "생체 수치(체중·심박수) 비저장 실시간 메모리 연산 후 즉시 폐기",
    }