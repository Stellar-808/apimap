const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const MIN_NOMINATIM_INTERVAL = 1100;

const form = document.querySelector("#route-form");
const calculateButton = document.querySelector("#calculate-button");
const formMessage = document.querySelector("#form-message");
const emptyResult = document.querySelector("#empty-result");
const routeResult = document.querySelector("#route-result");
const fields = {
  origin: document.querySelector("#origin"),
  destination: document.querySelector("#destination"),
};
const places = { origin: null, destination: null };
const searchState = {};
let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;
let routeRequestId = 0;

function setMessage(message, type = "") {
  formMessage.textContent = message;
  formMessage.className = `form-message${type ? ` is-${type}` : ""}`;
}

function updateCalculateButton() {
  calculateButton.disabled = !places.origin || !places.destination;
}

function closeSuggestions(fieldName) {
  const field = fields[fieldName];
  const list = document.querySelector(`#${fieldName}-suggestions`);
  list.hidden = true;
  list.replaceChildren();
  field.setAttribute("aria-expanded", "false");
}

function queueNominatimSearch(query, isCurrent) {
  const request = nominatimQueue.then(async () => {
    if (!isCurrent()) return null;

    const wait = Math.max(
      0,
      MIN_NOMINATIM_INTERVAL - (Date.now() - lastNominatimRequestAt),
    );
    if (wait > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, wait));
    }
    if (!isCurrent()) return null;

    lastNominatimRequestAt = Date.now();
    const url = new URL(NOMINATIM_URL);
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "ko",
    });

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`장소 검색에 실패했습니다. (${response.status})`);
    }
    return response.json();
  });

  nominatimQueue = request.catch(() => undefined);
  return request;
}

function renderSuggestions(fieldName, results) {
  const field = fields[fieldName];
  const list = document.querySelector(`#${fieldName}-suggestions`);
  list.replaceChildren();

  if (results.length === 0) {
    const empty = document.createElement("li");
    empty.className = "no-suggestions";
    empty.textContent = "검색 결과가 없습니다. 다른 이름으로 검색해 보세요.";
    list.append(empty);
    list.hidden = false;
    field.setAttribute("aria-expanded", "true");
    return;
  }

  for (const result of results) {
    const option = document.createElement("li");
    option.setAttribute("role", "presentation");
    const button = document.createElement("button");
    button.className = "suggestion-option";
    button.type = "button";
    button.setAttribute("role", "option");

    const name = document.createElement("span");
    name.className = "suggestion-name";
    name.textContent = result.name || result.display_name.split(",")[0];
    const detail = document.createElement("span");
    detail.className = "suggestion-detail";
    detail.textContent = result.display_name;
    button.append(name, detail);
    button.addEventListener("click", () => selectPlace(fieldName, result));
    option.append(button);
    list.append(option);
  }

  list.hidden = false;
  field.setAttribute("aria-expanded", "true");
}

function selectPlace(fieldName, place) {
  places[fieldName] = place;
  fields[fieldName].value = place.name || place.display_name.split(",")[0];
  document.querySelector(`[data-field="${fieldName}"] .clear-button`).hidden = false;
  closeSuggestions(fieldName);
  updateCalculateButton();

  if (places.origin && places.destination) {
    setMessage("출발지와 도착지를 확인했어요. 거리를 계산해 보세요.");
  } else {
    setMessage(`${fieldName === "origin" ? "출발지" : "도착지"}를 선택했어요. 다른 장소도 검색해 주세요.`);
  }
}

function searchPlaces(fieldName, query, requestId) {
  const isCurrent = () =>
    searchState[fieldName].requestId === requestId &&
    fields[fieldName].value.trim() === query;

  queueNominatimSearch(query, isCurrent)
    .then((results) => {
      if (!isCurrent() || results === null) return;
      renderSuggestions(fieldName, results);
      setMessage(results.length ? "검색 결과에서 정확한 장소를 선택해 주세요." : "검색 결과가 없습니다.", results.length ? "" : "error");
    })
    .catch((error) => {
      if (!isCurrent()) return;
      closeSuggestions(fieldName);
      setMessage(error.message || "장소 검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error");
    });
}

for (const [fieldName, field] of Object.entries(fields)) {
  field.addEventListener("input", () => {
    const state = searchState[fieldName];
    window.clearTimeout(state?.timer);
    const requestId = (state?.requestId || 0) + 1;
    searchState[fieldName] = { requestId, timer: null };
    places[fieldName] = null;
    routeRequestId += 1;
    emptyResult.hidden = false;
    routeResult.hidden = true;
    document.querySelector(`[data-field="${fieldName}"] .clear-button`).hidden = !field.value;
    updateCalculateButton();
    closeSuggestions(fieldName);

    const query = field.value.trim();
    if (query.length < 2) {
      setMessage(query ? "두 글자 이상 입력해 주세요." : "검색 결과에서 실제 장소를 선택해 주세요.");
      return;
    }

    setMessage("장소를 검색하고 있어요.", "loading");
    searchState[fieldName].timer = window.setTimeout(
      () => searchPlaces(fieldName, query, requestId),
      450,
    );
  });

  field.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSuggestions(fieldName);
    if (event.key === "ArrowDown") {
      const firstOption = document.querySelector(`#${fieldName}-suggestions .suggestion-option`);
      if (firstOption) {
        event.preventDefault();
        firstOption.focus();
      }
    }
  });

  document.querySelector(`[data-field="${fieldName}"] .clear-button`).addEventListener("click", () => {
    field.value = "";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  });
}

document.querySelector("#swap-button").addEventListener("click", () => {
  const originPlace = places.origin;
  const destinationPlace = places.destination;
  const originValue = fields.origin.value;
  const destinationValue = fields.destination.value;

  places.origin = destinationPlace;
  places.destination = originPlace;
  routeRequestId += 1;
  emptyResult.hidden = false;
  routeResult.hidden = true;
  fields.origin.value = destinationValue;
  fields.destination.value = originValue;

  for (const fieldName of Object.keys(fields)) {
    document.querySelector(`[data-field="${fieldName}"] .clear-button`).hidden = !fields[fieldName].value;
    closeSuggestions(fieldName);
  }

  updateCalculateButton();
  if (places.origin && places.destination) {
    setMessage("출발지와 도착지를 바꿨어요. 거리를 다시 계산해 보세요.");
  } else {
    setMessage("검색 결과에서 실제 장소를 선택해 주세요.");
  }
});

function formatDistance(meters) {
  const kilometers = meters / 1000;
  return kilometers.toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `약 ${minutes}분 소요`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes
    ? `약 ${hours}시간 ${remainingMinutes}분 소요`
    : `약 ${hours}시간 소요`;
}

function mapDirectionsUrl(origin, destination) {
  const route = `${origin.lat},${origin.lon};${destination.lat},${destination.lon}`;
  const url = new URL("https://www.openstreetmap.org/directions");
  url.searchParams.set("engine", "fossgis_osrm_car");
  url.searchParams.set("route", route);
  return url.href;
}

async function calculateRoute() {
  const origin = places.origin;
  const destination = places.destination;
  if (!origin || !destination) {
    setMessage("검색 결과에서 출발지와 도착지를 모두 선택해 주세요.", "error");
    return;
  }

  const requestId = ++routeRequestId;
  emptyResult.hidden = false;
  routeResult.hidden = true;
  calculateButton.disabled = true;
  calculateButton.classList.add("is-loading");
  calculateButton.querySelector("span").textContent = "거리를 계산하고 있어요";
  setMessage("자동차 경로를 확인하고 있어요.", "loading");

  try {
    const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
    const url = `${OSRM_URL}/${coordinates}?overview=false&steps=false`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`경로를 불러오지 못했습니다. (${response.status})`);

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("두 장소 사이의 자동차 경로를 찾지 못했습니다.");
    }
    if (requestId !== routeRequestId) return;

    const route = data.routes[0];
    document.querySelector("#distance-value").textContent = formatDistance(route.distance);
    document.querySelector("#duration-value").textContent = formatDuration(route.duration);
    document.querySelector("#origin-name").textContent = origin.name || origin.display_name.split(",")[0];
    document.querySelector("#destination-name").textContent = destination.name || destination.display_name.split(",")[0];
    document.querySelector("#map-link").href = mapDirectionsUrl(origin, destination);
    emptyResult.hidden = true;
    routeResult.hidden = false;
    setMessage("경로를 찾았어요. 지도에서 자세한 길을 확인할 수 있습니다.");
  } catch (error) {
    if (requestId !== routeRequestId) return;
    setMessage(error.message || "경로 계산 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error");
  } finally {
    if (requestId === routeRequestId) {
      calculateButton.disabled = !places.origin || !places.destination;
      calculateButton.classList.remove("is-loading");
      calculateButton.querySelector("span").textContent = "거리 확인하기";
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateRoute();
});

document.addEventListener("click", (event) => {
  for (const [fieldName, field] of Object.entries(fields)) {
    if (!field.closest(".field-group").contains(event.target)) {
      closeSuggestions(fieldName);
    }
  }
});
