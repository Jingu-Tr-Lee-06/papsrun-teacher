import fs from "fs";
import path from "path";

const targetDir = path.join(process.cwd(), "Final_code");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const studentModules = [
  // Team 1: 지구과학·미기상 & 기상 안전
  {
    id: 1,
    filename: "student_01_albedo.py",
    code: `# [학생 01번] 노면 알베도(반사율) 매핑 모듈
def get_surface_albedo(surface_type: str) -> float:
    albedo_table = {
        "asphalt_new": 0.05,
        "asphalt_old": 0.15,
        "concrete": 0.25,
        "dirt": 0.20,
        "grass": 0.25,
        "urethane": 0.12
    }
    return albedo_table.get(surface_type, 0.15)
`
  },
  {
    id: 2,
    filename: "student_02_solar.py",
    code: `# [학생 02번] 그늘 차광률 및 유효 일사량 연산 모듈
def calculate_effective_solar(base_solar_radiation: float, is_shaded: bool) -> float:
    if is_shaded:
        return round(base_solar_radiation * 0.30, 2)
    return float(base_solar_radiation)
`
  },
  {
    id: 3,
    filename: "student_03_radiation.py",
    code: `# [학생 03번] 지표면 순흡수 복사에너지(R_abs) 연산 모듈
def calculate_absorbed_radiation(effective_solar: float, albedo: float) -> float:
    r_abs = effective_solar * (1.0 - albedo)
    return round(r_abs, 2)
`
  },
  {
    id: 4,
    filename: "student_04_slope_dem.py",
    code: `# [학생 04번] DEM 고도차 기반 경사도(%) 계산 모듈
def compute_edge_slope(delta_h_meters: float, distance_meters: float) -> float:
    if distance_meters <= 0:
        return 0.0
    slope_pct = (delta_h_meters / distance_meters) * 100.0
    return round(slope_pct, 2)
`
  },
  {
    id: 5,
    filename: "student_05_failsafe.py",
    code: `# [학생 05번] 33°C 폭염 야외 주행 강제 차단 안전 인터락 모듈
def check_weather_failsafe(temperature_celsius: float) -> bool:
    if temperature_celsius >= 33.0:
        return False  # 주행 강제 차단 (Fail-Safe 작동)
    return True
`
  },

  // Team 2: 체육·생체역학 & ML 심박 추론
  {
    id: 6,
    filename: "student_06_step_test.py",
    code: `# [학생 06번] 3분 스텝검사 기초 심박 상승치 산출 모듈
def calculate_base_delta_hr(paps_grade: int) -> float:
    step_delta_map = {1: 18.0, 2: 24.0, 3: 30.0, 4: 38.0, 5: 46.0}
    return float(step_delta_map.get(paps_grade, 30.0))
`
  },
  {
    id: 7,
    filename: "student_07_paps_weight.py",
    code: `# [학생 07번] PAPS 등급 및 체중별 운동 부하 계수 모듈
def get_paps_strain_factor(paps_grade: int, body_weight_kg: float = 60.0) -> float:
    base_factor = {1: 0.85, 2: 1.0, 3: 1.15, 4: 1.35, 5: 1.6}.get(paps_grade, 1.0)
    weight_ratio = body_weight_kg / 60.0
    return round(base_factor * weight_ratio, 3)
`
  },
  {
    id: 8,
    filename: "student_08_ml_regression.py",
    code: `# [학생 08번] 머신러닝 다중회귀 OLS 기반 심박 상승치 추론 모듈
def predict_ml_bpm_gain(distance_m: float, slope_pct: float, r_abs: float) -> float:
    bpm_gain = (0.015 * distance_m) + (1.85 * max(0.0, slope_pct)) + (0.02 * (r_abs / 100.0))
    return round(bpm_gain, 2)
`
  },
  {
    id: 9,
    filename: "student_09_clamping.py",
    code: `# [학생 09번] 최대 심박수 한계선(220 BPM) 보호 클램핑 모듈
def clamp_physiological_bpm(current_bpm: float, max_limit: float = 220.0) -> float:
    clamped = max(40.0, min(float(current_bpm), float(max_limit)))
    return round(clamped, 1)
`
  },
  {
    id: 10,
    filename: "student_10_target_hr.py",
    code: `# [학생 10번] 카보넨(Karvonen) 공식 유효 유산소 심박수(THR) 평가 모듈
def evaluate_target_hr_zone(current_bpm: float, resting_hr: float = 65.0, age: int = 15) -> str:
    hr_max = 220.0 - age
    hr_reserve = hr_max - resting_hr
    target_low = resting_hr + (hr_reserve * 0.60)
    target_high = resting_hr + (hr_reserve * 0.80)

    if current_bpm < target_low:
        return "LOW_INTENSITY (준비 운동 구간)"
    elif current_bpm <= target_high:
        return "AEROBIC_TARGET_ZONE (최적 유산소 구간)"
    else:
        return "HIGH_STRAIN_ALERT (심혈관 과부하 경고)"
`
  },

  // Team 3: 수학·위상 & 다익스트라 최적화 코어
  {
    id: 11,
    filename: "student_11_topology.py",
    code: `# [학생 11번] 캠퍼스 도로망 그래프 무결성 및 고립 노드 검증 모듈
def validate_campus_graph(num_nodes: int, num_components: int, isolated_count: int) -> dict:
    is_valid = (num_components == 1) and (isolated_count == 0)
    penalty = (num_components - 1) * 25 + isolated_count * 15
    score = max(0, 100 - penalty)
    return {
        "is_routable": is_valid,
        "topology_score": score,
        "isolated_nodes": isolated_count
    }
`
  },
  {
    id: 12,
    filename: "student_12_normalizer.py",
    code: `# [학생 12번] 이종 데이터 Min-Max 0~1 선형 정규화 모듈
def min_max_normalize(val: float, val_min: float, val_max: float) -> float:
    if val_max <= val_min:
        return 0.0
    clamped = max(val_min, min(val, val_max))
    normalized = (clamped - val_min) / (val_max - val_min)
    return round(normalized, 4)
`
  },
  {
    id: 13,
    filename: "student_13_joint_guard.py",
    code: `# [학생 13번] 노면 충격량 관절 보호 페널티 계수 모듈
def get_surface_joint_penalty(surface_type: str, paps_grade: int) -> float:
    hardness = {
        "urethane": 0.7, "grass": 0.8, "dirt": 0.9,
        "asphalt_old": 1.2, "concrete": 1.3, "asphalt_new": 1.4
    }.get(surface_type, 1.0)
    grade_factor = 1.3 if paps_grade >= 4 else 1.0
    return round(hardness * grade_factor, 3)
`
  },
  {
    id: 14,
    filename: "student_14_steep_cost.py",
    code: `# [학생 14번] 급경사(>5%) 비선형 페널티 모듈
def calculate_slope_strain_penalty(slope_pct: float, paps_grade: int) -> float:
    if slope_pct <= 0:
        return 0.0
    if slope_pct > 5.0 and paps_grade >= 4:
        return round(((slope_pct - 5.0) ** 2) * 0.5, 3)
    return round(slope_pct * 0.2, 3)
`
  },
  {
    id: 15,
    filename: "student_15_dijkstra_core.py",
    code: `# [학생 15번] 다익스트라 최적화 코어 음수 비용 방어(max 0.1) 래퍼 모듈
def compute_final_dijkstra_edge_cost(base_cost: float, min_floor: float = 0.1) -> float:
    return max(float(min_floor), round(float(base_cost), 4))
`
  },

  // Team 4: 정보·UI, 시각화 & AI 윤리
  {
    id: 16,
    filename: "student_16_sidebar_ui.py",
    code: `# [학생 16번] 사용자 설정 및 동일 출발/도착 방어 인터락 모듈
def validate_route_selection(start_node: str, end_node: str) -> dict:
    if not start_node or not end_node:
        return {"valid": False, "message": "출발 노드와 도착 노드를 모두 선택해야 합니다."}
    if start_node == end_node:
        return {"valid": False, "message": "출발 노드와 도착 노드가 동일합니다. 다른 노드를 지정하세요."}
    return {"valid": True, "message": "경로 탐색 준비 완료"}
`
  },
  {
    id: 17,
    filename: "student_17_privacy.py",
    code: `# [학생 17번] 차분 프라이버시(Differential Privacy) GPS 좌표 노이즈 마스킹 모듈
import random

def mask_coordinates_privacy(lat: float, lng: float, epsilon_noise: float = 0.00005) -> tuple:
    noise_lat = random.uniform(-epsilon_noise, epsilon_noise)
    noise_lng = random.uniform(-epsilon_noise, epsilon_noise)
    return (round(lat + noise_lat, 6), round(lng + noise_lng, 6))
`
  },
  {
    id: 18,
    filename: "student_18_map_render.py",
    code: `# [학생 18번] 추천 경로 다색 렌더링 스타일링 모듈
def get_path_render_style(path_type: str) -> dict:
    styles = {
        "shortest": {"color": "#ef4444", "weight": 4, "dashArray": "5, 5", "label": "최단거리 코스"},
        "cooling": {"color": "#0ea5e9", "weight": 6, "dashArray": None, "label": "쿨링(그늘) 코스"},
        "joint_care": {"color": "#10b981", "weight": 6, "dashArray": None, "label": "PAPS 맞춤 안심 코스"}
    }
    return styles.get(path_type, {"color": "#6366f1", "weight": 5, "dashArray": None, "label": "추천 코스"})
`
  },
  {
    id: 19,
    filename: "student_19_metrics_table.py",
    code: `# [학생 19번] 거리·고도·심박 3단 비교 카드 데이터 구성 모듈
def build_comparison_metrics(distance_m: float, delta_h_m: float, avg_bpm: float) -> dict:
    return {
        "total_distance_km": round(distance_m / 1000.0, 2),
        "elevation_gain_m": round(delta_h_m, 1),
        "predicted_avg_bpm": round(avg_bpm, 1),
        "is_safe_for_paps_4_5": avg_bpm <= 165.0
    }
`
  },
  {
    id: 20,
    filename: "student_20_xai_explainer.py",
    code: `# [학생 20번] 설명가능한 AI(XAI) 경로 추천 사유 해설 패널 모듈
def generate_xai_explanation(is_detour: bool, saved_bpm: float, shaded_ratio: float) -> str:
    if is_detour:
        return (
            f"💡 [알고리즘 추천 사유]\\n"
            f"직선 오르막 대비 거리가 약 40m 늘어나지만, 예상 심박수 급증을 {saved_bpm:.1f} BPM 줄이고 "
            f"그늘 비율 {shaded_ratio * 100:.0f}% 구간을 우선 통과하여 심폐 과부하를 안전하게 방어합니다."
        )
    return "💡 [알고리즘 추천 사유] 경사도가 완만하고 열부하가 낮아 기본 최단 경로로 안내합니다."
`
  }
];

studentModules.forEach((m) => {
  const filePath = path.join(targetDir, m.filename);
  fs.writeFileSync(filePath, m.code.trim() + "\n", "utf-8");
});

console.log(`✅ Final_code 폴더에 20개 전담 모듈 파일 생성이 완료되었습니다.`);