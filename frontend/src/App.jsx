import React, { useEffect, useMemo, useRef, useState } from "react";
import api, { setAuthToken } from "./api";
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
        <h1>Shared Fun</h1>
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

      {view === "game" && <Game token={token} />}
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

function Game({ token }) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [players, setPlayers] = useState([]);
  const [orbs, setOrbs] = useState([]);
  const [world, setWorld] = useState({ w: 1200, h: 800 });

  const keys = useRef({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;

    socket.on("world-init", ({ WORLD, orbs }) => {
      setWorld(WORLD);
      setOrbs(orbs);
    });
    socket.on("players", (arr) => setPlayers(arr));
    socket.on("state", ({ players, orbs }) => {
      setPlayers(players);
      setOrbs(orbs);
    });
    socket.on("error-msg", (m) => console.log("WS error:", m));

    const onKey = (e, v) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (["w", "arrowup"].includes(k)) keys.current.up = v;
      if (["s", "arrowdown"].includes(k)) keys.current.down = v;
      if (["a", "arrowleft"].includes(k)) keys.current.left = v;
      if (["d", "arrowright"].includes(k)) keys.current.right = v;
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

  // Draw loop
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    let animationId;

    function draw() {
      const { width, height } = canvasRef.current;
      // background grid
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, width, height);

      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // fit world to canvas (center & scale)
      const scale = Math.min(width / world.w, height / world.h);
      const ox = (width - world.w * scale) / 2;
      const oy = (height - world.h * scale) / 2;

      // world bounds
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(ox, oy, world.w * scale, world.h * scale);

      // orbs
      for (const o of orbs) {
        const x = ox + o.x * scale;
        const y = oy + o.y * scale;
        ctx.beginPath();
        ctx.fillStyle = "rgba(80,200,255,0.9)";
        ctx.arc(x, y, 10 * scale, 0, Math.PI * 2);
        ctx.fill();
        // glow
        const g = ctx.createRadialGradient(x, y, 0, x, y, 30 * scale);
        g.addColorStop(0, "rgba(80,200,255,0.7)");
        g.addColorStop(1, "rgba(80,200,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 30 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // players & leaderboard
      const scores = [];
      for (const p of players) {
        const x = ox + p.x * scale;
        const y = oy + p.y * scale;

        ctx.beginPath();
        ctx.fillStyle = `hsl(${p.hue} 80% 55%)`;
        ctx.arc(x, y, 14 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${Math.max(12, 14 * scale)}px system-ui, sans-serif`;
        ctx.fillStyle = "white";
        ctx.fillText(p.name, x + 16 * scale, y - 10 * scale);
        ctx.fillText(`${p.score}`, x + 16 * scale, y + 8 * scale);
        scores.push({ name: p.name, score: p.score });
      }

      // leaderboard (top-right)
      scores.sort((a, b) => b.score - a.score);
      const pad = 10;
      let lx = width - 220,
        ly = 20;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(lx - 8, ly - 8, 208, 28 + Math.min(10, scores.length) * 24);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(
        lx - 8,
        ly - 8,
        208,
        28 + Math.min(10, scores.length) * 24
      );
      ctx.fillStyle = "#fff";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("Leaderboard", lx, ly + 8);
      ctx.font = "14px system-ui, sans-serif";
      for (let i = 0; i < Math.min(10, scores.length); i++) {
        ctx.fillText(
          `${i + 1}. ${scores[i].name} — ${scores[i].score}`,
          lx,
          ly + 28 + i * 22
        );
      }

      animationId = requestAnimationFrame(draw);
    }

    function onResize() {
      const c = canvasRef.current;
      c.width = c.clientWidth * window.devicePixelRatio;
      c.height = c.clientHeight * window.devicePixelRatio;
    }
    onResize();
    window.addEventListener("resize", onResize);

    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
    };
  }, [players, orbs, world]);

  return (
    <div className="game-wrap">
      <div className="controls">
        <span>Move: WASD / ↑↓←→</span>
        <span>Goal: Collect orbs — endless loop</span>
      </div>
      <canvas ref={canvasRef} className="game-canvas" />
    </div>
  );
}
