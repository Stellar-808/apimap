# 어디까지 — 거리 측정 앱

출발지와 도착지를 OpenStreetMap Nominatim에서 검색하고, OSRM 자동차 경로의 거리를 보여주는 정적 웹앱입니다. 결과의 **지도에서 보기** 링크는 OpenStreetMap의 경로 안내로 연결됩니다.

## 실행

`index.html`을 정적 파일 서버로 제공하면 됩니다. 빌드 단계나 외부 패키지가 필요하지 않습니다. 예를 들어 Node.js가 있다면 `npx serve .`로 로컬에서 확인할 수 있습니다.

## Vercel 배포

GitHub 저장소를 Vercel에 가져온 뒤 Framework Preset은 **Other**로 두고 Build Command와 Output Directory를 비워 두면 저장소의 `index.html`이 바로 제공됩니다. Redis, 서버 함수, 별도 환경변수는 사용하지 않습니다.

## 공개 지도 서비스 안내

- 장소 검색은 Nominatim 공개 API를 사용합니다. 입력을 멈춘 뒤 검색하고 앱에서 요청 간격을 제한하지만, Nominatim 공개 인스턴스는 사용량 정책과 용량 제한이 있으므로 대규모·상업 서비스에는 자체 호스팅 또는 별도 제공자를 고려하세요.
- 자동차 거리와 예상 시간은 공개 OSRM 데모 라우터를 사용합니다. 데모 서비스의 가용성이나 응답 속도는 보장되지 않습니다.
- 거리·예상 시간은 자동차 경로 기준의 근사치이며 실시간 교통 정보가 아닙니다.
- 지도 데이터 © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
