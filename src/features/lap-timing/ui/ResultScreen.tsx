// 기록 화면 — 측정 화면과 동일 디자인 언어(confirmed-design.md 화면2). ← 뒤로 + 초기화 단일.
import { useLapStore } from "../model/store";
import { fmt } from "./format";
import { SignatureStamp } from "./SignatureStamp";

export function ResultScreen() {
  const s = useLapStore();
  const best = s.laps.length ? Math.min(...s.laps.map((l) => l.durationMs)) : null;
  const avg = s.laps.length ? s.laps.reduce((a, l) => a + l.durationMs, 0) / s.laps.length : null;
  const sd =
    s.laps.length > 1 && avg != null
      ? Math.sqrt(s.laps.reduce((a, l) => a + (l.durationMs - avg) ** 2, 0) / s.laps.length)
      : null;

  const onReset = () => {
    if (confirm("이 기록을 초기화할까요? 되돌릴 수 없습니다.")) s.reset();
  };

  return (
    <>
      <header className="bar">
        <div className="row" style={{ gap: "var(--s1)" }}>
          <button className="iconbtn" onClick={s.back} aria-label="뒤로" style={{ fontSize: "var(--font-h2)", padding: "0 var(--s1)" }}>
            ←
          </button>
          <h1>기록</h1>
        </div>
        <span className="caption">{s.laps.length}랩</span>
      </header>
      <div className="statrow" style={{ paddingTop: "var(--s4)", paddingBottom: "var(--s4)" }}>
        <div className="stat">
          <div className="overline">Best</div>
          <div className="v tnum">{best != null ? fmt(best) : "—"}</div>
        </div>
        <div className="stat">
          <div className="overline">평균</div>
          <div className="v tnum">{avg != null ? fmt(avg) : "—"}</div>
        </div>
        <div className="stat">
          <div className="overline">편차 σ</div>
          <div className="v tnum">{sd != null ? `±${Math.round(sd)}ms` : "—"}</div>
        </div>
      </div>
      <div className="overline" style={{ padding: "var(--s2) var(--s4)" }}>
        랩 기록
      </div>
      <div className="laplist">
        {s.laps.length ? (
          s.laps.map((l) => (
            <div key={l.n}>
              <div className={`laprow${l.durationMs === best ? " best" : ""}`}>
                <span>
                  랩 {l.n}
                  {l.suspect && <span className="badge">의심</span>}
                </span>
                {/* R13: 이 랩을 끊은 통과의 색 지문 — 의심 랩에서 "내 차였나" 시각 판별 근거 */}
                {l.sig && l.sig.length > 0 && <SignatureStamp sig={l.sig} cell={4} />}
                <span className="tnum">{fmt(l.durationMs)}</span>
              </div>
              {l.candidatesMs && l.candidatesMs.length > 1 && (
                // R10-c: 의심 통과가 여러 번이었던 랩 — 전 후보를 시간순 표기(첫 항목 = 채택값)
                <div className="caption" style={{ padding: "0 var(--s3) var(--s2)" }}>
                  의심 후보(시간순): {l.candidatesMs.map((ms) => fmt(ms)).join(" · ")}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="caption" style={{ textAlign: "center", padding: "var(--s6)" }}>
            기록된 랩이 없습니다
          </p>
        )}
      </div>
      <p className="caption" style={{ padding: "var(--s3) var(--s4)" }}>
        다른 차 통과 {s.otherPass}회 무시됨 · 타깃 색으로 내 차만 계측
      </p>
      <div className="grow" />
      {/* R12: 리스트가 길어도 초기화는 하단 고정 (pinned = sticky bottom) */}
      <div className="bottom-cta pinned">
        <button className="btn btn-danger" style={{ width: "100%" }} onClick={onReset}>
          초기화
        </button>
      </div>
    </>
  );
}
