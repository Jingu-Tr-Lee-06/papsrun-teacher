# [학생 17번] 차분 프라이버시(Differential Privacy) GPS 좌표 노이즈 마스킹 모듈
import random

def mask_coordinates_privacy(lat: float, lng: float, epsilon_noise: float = 0.00005) -> tuple:
    noise_lat = random.uniform(-epsilon_noise, epsilon_noise)
    noise_lng = random.uniform(-epsilon_noise, epsilon_noise)
    return (round(lat + noise_lat, 6), round(lng + noise_lng, 6))
