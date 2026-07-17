import { XMLParser } from "fast-xml-parser";
import type { PreviewAdapterId } from "@jk-external-api/catalog";
import { AdapterError, asRecord, at, fetchText, list, parseJson } from "./upstream.js";

export type SecretName = "DATA_GO_KR_API_KEY" | "KAKAO_REST_API_KEY" | "KOPIS_SERVICE_KEY";
export type AdapterContext = { fetcher: typeof fetch; timeoutMs: number; now: () => Date; secrets: Partial<Record<SecretName, string>> };

type AdapterDefinition = {
  sourceId: string; secret: SecretName; ttlSeconds: number; attribution: { label: string; url: string };
  run(query: Record<string, unknown>, context: AdapterContext): Promise<unknown>;
};

function dataGoUrl(path: string, key: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(`https://apis.data.go.kr/${path}`);
  url.searchParams.set("serviceKey", key);
  for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, String(value));
  return url.toString();
}

function jsonItems(text: string): unknown[] {
  const parsed = parseJson(text);
  try { return list(at(parsed, ["response", "body", "items", "item"])); }
  catch { try { return list(at(parsed, ["response", "body", "items"])); } catch { throw new AdapterError("BAD_UPSTREAM_RESPONSE", "원천 응답에서 항목 목록을 찾을 수 없습니다."); } }
}

function kmaGrid(lat: number, lng: number): { nx: number; ny: number } {
  const re = 6371.00877 / 5; const slat1 = 30 * Math.PI / 180; const slat2 = 60 * Math.PI / 180; const olon = 126 * Math.PI / 180; const olat = 38 * Math.PI / 180;
  const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(Math.tan(Math.PI * .25 + slat2 * .5) / Math.tan(Math.PI * .25 + slat1 * .5));
  const sf = Math.tan(Math.PI * .25 + slat1 * .5) ** sn * Math.cos(slat1) / sn; const ro = re * sf / Math.tan(Math.PI * .25 + olat * .5) ** sn;
  const ra = re * sf / Math.tan(Math.PI * .25 + lat * Math.PI / 360) ** sn; let theta = lng * Math.PI / 180 - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI; if (theta < -Math.PI) theta += 2 * Math.PI; theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + 43 + 1.5), ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 1.5) };
}

function kstBase(now: Date): { date: string; time: string } {
  const kst = new Date(now.getTime() + 9 * 3_600_000 - 3_600_000);
  return { date: kst.toISOString().slice(0, 10).replaceAll("-", ""), time: `${String(kst.getUTCHours()).padStart(2, "0")}00` };
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = (degree: number) => degree * Math.PI / 180; const dLat = radians(lat2 - lat1); const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const adapters: Record<PreviewAdapterId, AdapterDefinition> = {
  weather: {
    sourceId: "weather-kma", secret: "DATA_GO_KR_API_KEY", ttlSeconds: 600, attribution: { label: "기상청 단기예보 조회서비스", url: "https://www.data.go.kr/data/15084084/openapi.do" },
    async run(query, context) { const lat = Number(query.lat); const lng = Number(query.lng); const grid = kmaGrid(lat, lng); const base = kstBase(context.now()); const text = await fetchText(context.fetcher, dataGoUrl("1360000/VilageFcstInfoService_2.0/getUltraSrtNcst", context.secrets.DATA_GO_KR_API_KEY ?? "", { pageNo: 1, numOfRows: 20, dataType: "JSON", base_date: base.date, base_time: base.time, ...grid }), {}, context.timeoutMs); const items = jsonItems(text).map(asRecord); if (!items.length) throw new AdapterError("NO_RESULTS", "해당 위치의 관측 결과가 없습니다."); return { location: { lat, lng, ...grid }, observations: items.map((item) => ({ category: item.category, value: item.obsrValue, baseDate: item.baseDate, baseTime: item.baseTime })) }; },
  },
  "air-quality": {
    sourceId: "airkorea", secret: "DATA_GO_KR_API_KEY", ttlSeconds: 600, attribution: { label: "에어코리아 대기오염정보", url: "https://www.data.go.kr/data/15073861/openapi.do" },
    async run(query, context) { const text = await fetchText(context.fetcher, dataGoUrl("B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty", context.secrets.DATA_GO_KR_API_KEY ?? "", { returnType: "json", numOfRows: 100, pageNo: 1, sidoName: String(query.sido), ver: "1.3" }), {}, context.timeoutMs); let items = jsonItems(text).map(asRecord); if (query.station) items = items.filter((item) => item.stationName === query.station); if (!items.length) throw new AdapterError("NO_RESULTS", "해당 지역의 대기 관측 결과가 없습니다."); return items.slice(0, 20).map((item) => ({ station: item.stationName, measuredAt: item.dataTime, pm10: item.pm10Value, pm25: item.pm25Value, grade: item.khaiGrade })); },
  },
  "transit-arrival": {
    sourceId: "tago", secret: "DATA_GO_KR_API_KEY", ttlSeconds: 30, attribution: { label: "TAGO 국가대중교통정보", url: "https://www.data.go.kr/data/15098530/openapi.do" },
    async run(query, context) { const stationText = await fetchText(context.fetcher, dataGoUrl("1613000/BusSttnInfoInqireService/getSttnNoList", context.secrets.DATA_GO_KR_API_KEY ?? "", { _type: "json", numOfRows: 5, pageNo: 1, cityCode: query.cityCode ? String(query.cityCode) : undefined, nodeNm: String(query.q) }), {}, context.timeoutMs); const station = jsonItems(stationText).map(asRecord)[0]; if (!station) throw new AdapterError("NO_RESULTS", "검색한 정류장을 찾지 못했습니다."); const nodeId = String(station.nodeid ?? station.nodeId ?? ""); const arrivalText = await fetchText(context.fetcher, dataGoUrl("1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList", context.secrets.DATA_GO_KR_API_KEY ?? "", { _type: "json", numOfRows: 20, pageNo: 1, cityCode: query.cityCode ? String(query.cityCode) : undefined, nodeId }), {}, context.timeoutMs); const arrivals = jsonItems(arrivalText).map(asRecord); if (!arrivals.length) throw new AdapterError("NO_RESULTS", "현재 도착 예정 차량이 없습니다."); return { station: { id: nodeId, name: station.nodenm ?? station.nodeNm }, arrivals: arrivals.map((item) => ({ route: item.routeno ?? item.routeNo, seconds: item.arrtime ?? item.arrTime, stopsAway: item.arrprevstationcnt })) }; },
  },
  "public-facilities": {
    sourceId: "data-go-kr", secret: "DATA_GO_KR_API_KEY", ttlSeconds: 86_400, attribution: { label: "전국공공시설개방정보표준데이터", url: "https://www.data.go.kr/data/15013117/openapi.do" },
    async run(query, context) { const lat = Number(query.lat); const lng = Number(query.lng); const radiusM = Number(query.radiusM); const text = await fetchText(context.fetcher, dataGoUrl("openapi/tn_pubr_public_pblfclt_opn_info_api", context.secrets.DATA_GO_KR_API_KEY ?? "", { type: "json", pageNo: 1, numOfRows: 500 }), {}, context.timeoutMs); const items = jsonItems(text).map(asRecord).map((item) => ({ item, lat: Number(item.latitude), lng: Number(item.longitude) })).filter(({ lat: itemLat, lng: itemLng }) => Number.isFinite(itemLat) && Number.isFinite(itemLng)).map(({ item, lat: itemLat, lng: itemLng }) => ({ name: item.openFcltyNm, place: item.openLcNm, type: item.openFcltyType, address: item.rdnmadr ?? item.lnmadr, operator: item.insttNm, phone: item.phoneNumber, lat: itemLat, lng: itemLng, distanceM: distanceMeters(lat, lng, itemLat, itemLng) })).filter(({ distanceM }) => distanceM <= radiusM).sort((left, right) => left.distanceM - right.distanceM).slice(0, 20); if (!items.length) throw new AdapterError("NO_RESULTS", "선택 반경에서 개방 공공시설을 찾지 못했습니다."); return items; },
  },
  places: {
    sourceId: "kakao-local-mobility", secret: "KAKAO_REST_API_KEY", ttlSeconds: 3_600, attribution: { label: "Kakao Local API", url: "https://developers.kakao.com/docs/latest/ko/local/dev-guide" },
    async run(query, context) { const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json"); url.searchParams.set("query", String(query.q)); url.searchParams.set("size", "15"); if (query.lat !== undefined && query.lng !== undefined) { url.searchParams.set("y", String(query.lat)); url.searchParams.set("x", String(query.lng)); url.searchParams.set("radius", String(query.radiusM)); } const text = await fetchText(context.fetcher, url.toString(), { headers: { Authorization: `KakaoAK ${context.secrets.KAKAO_REST_API_KEY ?? ""}` } }, context.timeoutMs); const parsed = asRecord(parseJson(text)); const items = list(parsed.documents).map(asRecord); if (!items.length) throw new AdapterError("NO_RESULTS", "장소 검색 결과가 없습니다."); return items.map((item) => ({ id: item.id, name: item.place_name, category: item.category_name, address: item.road_address_name || item.address_name, lat: Number(item.y), lng: Number(item.x), distanceM: item.distance ? Number(item.distance) : undefined, url: item.place_url })); },
  },
  performances: {
    sourceId: "culture-kopis", secret: "KOPIS_SERVICE_KEY", ttlSeconds: 21_600, attribution: { label: "KOPIS 공연예술통합전산망", url: "https://www.kopis.or.kr/por/cs/openapi/openApiList.do" },
    async run(query, context) { const url = new URL("http://www.kopis.or.kr/openApi/restful/pblprfr"); url.searchParams.set("service", context.secrets.KOPIS_SERVICE_KEY ?? ""); url.searchParams.set("stdate", String(query.from).replaceAll("-", "")); url.searchParams.set("eddate", String(query.to).replaceAll("-", "")); url.searchParams.set("cpage", "1"); url.searchParams.set("rows", "20"); if (query.region) url.searchParams.set("signgucode", String(query.region)); if (query.q) url.searchParams.set("shprfnm", String(query.q)); const text = await fetchText(context.fetcher, url.toString(), {}, context.timeoutMs); let parsed: unknown; try { parsed = new XMLParser({ ignoreAttributes: false }).parse(text); } catch { throw new AdapterError("BAD_UPSTREAM_RESPONSE", "KOPIS XML 형식을 해석할 수 없습니다."); } let items: Record<string, unknown>[]; try { items = list(at(parsed, ["dbs", "db"])).map(asRecord); } catch { throw new AdapterError("BAD_UPSTREAM_RESPONSE", "KOPIS 응답에서 공연 목록을 찾을 수 없습니다."); } if (!items.length) throw new AdapterError("NO_RESULTS", "선택한 기간의 공연이 없습니다."); return items.map((item) => ({ id: item.mt20id, name: item.prfnm, from: item.prfpdfrom, to: item.prfpdto, venue: item.fcltynm, state: item.prfstate })); },
  },
};
