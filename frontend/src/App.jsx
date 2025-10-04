import React, { useEffect, useMemo, useRef, useState } from "react";
import api, { setAuthToken, getMe } from "./api";
import io from "socket.io-client";
import { useStore } from "./useStore";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const { token, user, setAuth, logout } = useStore();
  const [view, setView] = useState("auth"); // 'auth' | 'game'
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Auth forms
  const [signup, setSignup] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [login, setLogin] = useState({ emailOrUsername: "", password: "" });

  useEffect(() => {
    if (token) setAuthToken(token);
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        if (useStore.getState().token) {
          setBusy(true);
          const res = await getMe();

          setAuth(useStore.getState().token, {
            id: res.data.id || res.data._id,
            username: res.data.username,
            displayName: res.data.displayName,
            avatarHue: res.data.avatarHue,
            bestScore: res.data.bestScore,
            gamesPlayed: res.data.gamesPlayed,
            totalScore: res.data.totalScore,
          });
          setView("game");
        }
      } catch {
        logout();
        setAuthToken(null);
        setView("auth");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const clientMeta = useMemo(
    () => ({
      ua: navigator.userAgent,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      lang: navigator.language,
    }),
    []
  );

  async function doSignup(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/api/auth/signup", { ...signup, clientMeta });
      setAuth(res.data.token, res.data.user);
      setView("game");
    } catch (err) {
      setError(err?.response?.data?.error || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  async function doLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/api/auth/login", login);
      setAuth(res.data.token, res.data.user);
      setView("game");
    } catch (err) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function doLogout() {
    logout();
    setView("auth");
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Orb Game</h1>
        {user ? (
          <div className="userbox">
            <span
              className="avatar"
              style={{
                backgroundColor: `hsl(${user.avatarHue || 200} 80% 50%)`,
              }}
            />
            <span>{user.username}</span>
            <button className="ghost" onClick={doLogout}>
              Log out
            </button>
          </div>
        ) : null}
      </header>

      {view === "auth" && (
        <div className="authgrid">
          <form className="card" onSubmit={doSignup}>
            <h2>Create account</h2>
            <input
              required
              placeholder="Username"
              value={signup.username}
              onChange={(e) =>
                setSignup((s) => ({ ...s, username: e.target.value }))
              }
            />
            <input
              required
              placeholder="Email"
              type="email"
              value={signup.email}
              onChange={(e) =>
                setSignup((s) => ({ ...s, email: e.target.value }))
              }
            />
            <input
              required
              placeholder="Password"
              type="password"
              value={signup.password}
              onChange={(e) =>
                setSignup((s) => ({ ...s, password: e.target.value }))
              }
            />
            <button disabled={busy}>Sign up</button>
          </form>

          <form className="card" onSubmit={doLogin}>
            <h2>Log in</h2>
            <input
              required
              placeholder="Email or Username"
              value={login.emailOrUsername}
              onChange={(e) =>
                setLogin((s) => ({ ...s, emailOrUsername: e.target.value }))
              }
            />
            <input
              required
              placeholder="Password"
              type="password"
              value={login.password}
              onChange={(e) =>
                setLogin((s) => ({ ...s, password: e.target.value }))
              }
            />
            <button disabled={busy}>Log in</button>
          </form>
        </div>
      )}

      {view === "game" && <Game token={token} me={user?.username} />}

      {error && <div className="error">{error}</div>}

      <footer className="foot">
        <p>
          Tip: Use WASD or arrow keys. Collect glowing orbs. Endless, timeless
          fun.
        </p>
      </footer>
    </div>
  );
}

function Game({ token, me }) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [globalTop, setGlobalTop] = useState([]);

  const [players, setPlayers] = useState([]);
  const [orbs, setOrbs] = useState([]);
  const [speedOrb, setSpeedOrb] = useState(null);
  const [world, setWorld] = useState({ w: 1200, h: 800 });

  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showRadar, setShowRadar] = useState(true);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const keys = useRef({ up: false, down: false, left: false, right: false });

  const myScore = players.find((p) => p.name === me)?.lifetime || 0;

  // preload recent chat
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/chat/recent");
        if (!cancelled && Array.isArray(data)) {
          setMessages(
            data.map((m) => ({
              name: m.username,
              hue: m.hue,
              text: m.text,
            }))
          );
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // global leaderboard fetch
  useEffect(() => {
    let stop = false;
    async function fetchTop() {
      try {
        const { data } = await api.get("/api/profile/leaderboard");
        if (!stop) setGlobalTop(data || []);
      } catch {}
    }
    fetchTop();
    const id = setInterval(fetchTop, 8000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  // connect + input
  useEffect(() => {
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;

    socket.on("world-init", ({ WORLD, orbs, speedOrb }) => {
      setWorld(WORLD);
      setOrbs(orbs);
      setSpeedOrb(speedOrb || null); // NEW
    });
    socket.on("players", (arr) => setPlayers(arr));
    socket.on("state", ({ players, orbs, speedOrb }) => {
      setPlayers(players);
      setOrbs(orbs);
      setSpeedOrb(speedOrb || null);
    });
    socket.on("error-msg", (m) => console.log("WS error:", m));

    socket.on("chat", (msg) => {
      setMessages((prev) => [...prev.slice(-30), msg]); // keep last 30
    });

    const onKey = (e, v) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();

      // movement
      if (["w", "arrowup"].includes(k)) keys.current.up = v;
      if (["s", "arrowdown"].includes(k)) keys.current.down = v;
      if (["a", "arrowleft"].includes(k)) keys.current.left = v;
      if (["d", "arrowright"].includes(k)) keys.current.right = v;

      // toggles (only on keydown)
      if (v === true) {
        if (k === "m") setShowMiniMap((s) => !s);
        if (k === "r") setShowRadar((s) => !s);
      }

      socket.emit("move", keys.current);
    };
    const kd = (e) => onKey(e, true);
    const ku = (e) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      socket.disconnect();
    };
  }, [token]);

  // helpers
  function nearestOrbTo(x, y, orbs) {
    let best = null,
      bestD2 = Infinity;
    for (const o of orbs) {
      const dx = o.x - x,
        dy = o.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = o;
      }
    }
    return best;
  }

  // draw
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    let animationId = 0;

    function draw() {
      const DPR = window.devicePixelRatio || 1;
      const { width, height } = c;

      // bg
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, width, height);

      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40 * DPR) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40 * DPR) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // fit world
      const scale = Math.min(width / world.w, height / world.h);
      const ox = (width - world.w * scale) / 2;
      const oy = (height - world.h * scale) / 2;

      // world bounds
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(ox, oy, world.w * scale, world.h * scale);

      // who am I?
      const mePlayer = players.find((p) => p.name === me);

      // draw normal orbs
      for (const o of orbs) {
        const x = ox + o.x * scale;
        const y = oy + o.y * scale;
        ctx.beginPath();
        ctx.fillStyle = "rgba(80,200,255,0.9)";
        ctx.arc(x, y, 10 * scale, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(x, y, 0, x, y, 30 * scale);
        g.addColorStop(0, "rgba(80,200,255,0.7)");
        g.addColorStop(1, "rgba(80,200,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 30 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Special rainbow Speed Booster orb (rare, single) ---
      if (speedOrb) {
        const t = (Date.now() % 4000) / 4000; // 0..1 cycle
        const hue = Math.floor(t * 360);
        const x = ox + speedOrb.x * scale;
        const y = oy + speedOrb.y * scale;

        const r = 12 * scale;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.95)`);
        g.addColorStop(1, `hsla(${(hue + 120) % 360}, 100%, 50%, 0.0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = Math.max(2, 3 * scale);
        ctx.strokeStyle = `hsla(${(hue + 180) % 360}, 100%, 65%, 0.9)`;
        ctx.beginPath();
        ctx.arc(x, y, r + 6 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // radar: line to nearest orb
      if (showRadar && mePlayer) {
        const target = nearestOrbTo(mePlayer.x, mePlayer.y, orbs);
        if (target) {
          const sx = ox + mePlayer.x * scale;
          const sy = oy + mePlayer.y * scale;
          const tx = ox + target.x * scale;
          const ty = oy + target.y * scale;

          const t = (Date.now() % 1000) / 1000; // pulse
          ctx.strokeStyle = `rgba(80,200,255,${
            0.6 + 0.4 * Math.sin(t * Math.PI * 2)
          })`;
          ctx.lineWidth = Math.max(1.5, 3 * scale);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          // highlight the target orb
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 2;
          ctx.arc(tx, ty, 16 * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // players + labels
      const scores = [];
      for (const p of players) {
        const x = ox + p.x * scale;
        const y = oy + p.y * scale;

        ctx.beginPath();
        ctx.fillStyle = `hsl(${p.hue} 80% 55%)`;
        ctx.arc(x, y, 14 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${Math.max(12, 14 * scale)}px system-ui, sans-serif`;
        ctx.fillStyle = p.name === me ? "#ffe680" : "white";
        ctx.fillText(p.name, x + 16 * scale, y - 10 * scale);
        ctx.fillText(`${p.lifetime}`, x + 16 * scale, y + 8 * scale);

        //  keep boosters per-player
        scores.push({
          name: p.name,
          score: p.lifetime,
          boosters: p.boosters || 0,
        });
      }

      // leaderboard (top-right)
      scores.sort((a, b) => b.score - a.score);
      const boxW = 240, // widen slightly for ⚡
        rowH = 22,
        headH = 28;
      const listN = Math.min(10, scores.length);
      const lx =
        width -
        ((boxW + 16) * (window.devicePixelRatio || 1)) /
          (window.devicePixelRatio || 1) -
        8;
      const ly = 20 * (window.devicePixelRatio || 1);

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(lx - 8, ly - 8, boxW, headH + listN * rowH);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(lx - 8, ly - 8, boxW, headH + listN * rowH);
      ctx.fillStyle = "#fff";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("Leaderboard", lx, ly + 8);
      ctx.font = "14px system-ui, sans-serif";
      for (let i = 0; i < listN; i++) {
        ctx.fillText(
          `${i + 1}. ${scores[i].name} — ${scores[i].score}  ⚡${
            scores[i].boosters
          }`,
          lx,
          ly + 28 + i * rowH
        );
      }

      // --- Global leaderboard (lifetime totals, from HTTP) ---
      const gx = lx;
      let gy = ly + (headH + listN * rowH) + 20; // below in-room board
      const gList = globalTop.slice(0, 10);
      const gHeight = headH + gList.length * rowH;

      if (gy + gHeight + 12 > height) {
        gy = Math.max(20, height - gHeight - 12);
      }

      // panel
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(gx - 8, gy - 8, boxW, gHeight);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(gx - 8, gy - 8, boxW, gHeight);

      // title + rows
      ctx.fillStyle = "#fff";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("Global Top (Lifetime)", gx, gy + 8);

      ctx.font = "14px system-ui, sans-serif";
      for (let i = 0; i < gList.length; i++) {
        const boosters = gList[i].speedBoosters || 0; // NEW
        const row = `${i + 1}. ${gList[i].username} — ${
          gList[i].totalScore
        }  ⚡${boosters}`;
        ctx.fillText(row, gx, gy + 28 + i * rowH);
      }

      // mini-map (bottom-left)
      if (showMiniMap) {
        const mmW = 180 * (window.devicePixelRatio || 1);
        const mmH = 120 * (window.devicePixelRatio || 1);
        const pad = 12 * (window.devicePixelRatio || 1);
        const mx = pad,
          my = height - mmH - pad;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(mx, my, mmW, mmH);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.strokeRect(mx, my, mmW, mmH);

        const mScale = Math.min(mmW / world.w, mmH / world.h);
        const mOx = mx + (mmW - world.w * mScale) / 2;
        const mOy = my + (mmH - world.h * mScale) / 2;

        // draw orbs on minimap
        ctx.fillStyle = "rgba(80,200,255,0.9)";
        for (const o of orbs) {
          ctx.fillRect(mOx + o.x * mScale - 2, mOy + o.y * mScale - 2, 4, 4);
        }

        // draw players on minimap
        for (const p of players) {
          ctx.fillStyle = p.name === me ? "#ffe680" : "#ffffff";
          ctx.fillRect(mOx + p.x * mScale - 2, mOy + p.y * mScale - 2, 4, 4);
        }

        // title
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText("Mini-Map (M)", mx + 8, my + 16);
      }

      animationId = requestAnimationFrame(draw);
    }

    function onResize() {
      const DPR = window.devicePixelRatio || 1;
      c.width = c.clientWidth * DPR;
      c.height = c.clientHeight * DPR;
    }
    onResize();
    window.addEventListener("resize", onResize);

    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
    };
  }, [players, orbs, speedOrb, world, showMiniMap, showRadar, me, globalTop]);

  return (
    <div className="game-wrap">
      <div className="controls">
        <span>Move: WASD / ↑↓←→</span>
        <span>Goal: Collect orbs — endless loop</span>
        <span>Mini-Map: M • Radar: R</span>
      </div>

      {/* HUD */}
      <div className="hud">
        <div className="chip">
          You&nbsp;<strong>{me || "…"}</strong>
        </div>
        <div className="chip">
          Score&nbsp;<strong>{myScore}</strong>
        </div>
        <div className="chip">
          Players&nbsp;<strong>{players.length}</strong>
        </div>
        <div className="chip hide-sm">
          Orbs&nbsp;<strong>{orbs.length}</strong>
        </div>
      </div>

      <canvas ref={canvasRef} className="game-canvas" />

      {/* Chat */}
      <div className="chat-box">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className="chat-message">
              <span style={{ color: `hsl(${m.hue} 80% 55%)` }}>{m.name}:</span>{" "}
              {m.text}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (chatInput.trim()) {
              socketRef.current.emit("chat", chatInput);
              setChatInput("");
            }
          }}
        >
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
          />
        </form>
      </div>
    </div>
  );
}
