# MERN Vite Fullstack - Orb Game

[![Made with React](https://img.shields.io/badge/React-18+-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5+-9462ff?logo=vite)](https://vitejs.dev/)
[![Node](https://img.shields.io/badge/Node-18%2B-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-black?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-black?logo=Socket.io)](https://socket.io/)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

> **Topics**: `mern` `vite` `react` `socket-io` `multiplayer` `canvas` `real-time` `jwt` `mongodb` `game-dev`

---

## Description

Fullstack multiplayer web application built with a React + Vite frontend and a Node.js/Express backend connected to MongoDB. It supports secure authentication (JWT), real-time gameplay with Socket.IO, and persistent player stats across sessions. The world updates continuously, allowing multiple users to play together in the same arena with smooth, low-latency communication.

Enhanced **orb interactions** and **user feedback systems**. In addition to standard collectible orbs, players encounter rare event-based elements such as speed boosters and lucky bonus orbs that alter movement and scoring dynamics. These are tracked persistently in each user’s profile, contributing to lifetime stats and global leaderboards. Real-time pop-up notifications, on-screen HUD chips, and live chat. The overall design focuses on an endless, replayable experience that rewards awareness, timing, and steady improvement rather than isolated rounds.

---

## Tech Stack & Dependencies

### Frontend (React + Vite)

**Core Libraries**

````bash
react                 # Component-based UI library
react-dom             # DOM renderer for React
axios                 # HTTP client for API requests
socket.io-client      # Real-time WebSocket communication
zustand               # Lightweight global state management
jwt-decode            # Client-side JWT parsing
vite                      # Frontend build tool
@vitejs/plugin-react       # React plugin for Vite
eslint                    # Code linting and formatting
@eslint/js                 # ESLint configuration for JS
eslint-plugin-react-hooks  # Ensures correct React hook usage
eslint-plugin-react-refresh# Enables hot reloading
globals                   # Common global variables
@types/react               # React type definitions
@types/react-dom           # React DOM type definitions


## Tech Stack & Dependencies

### Frontend (React + Vite)

**Core Libraries**

```bash
react                 # Component-based UI library
react-dom             # DOM renderer for React
axios                 # HTTP client for API requests
socket.io-client      # Real-time WebSocket communication
zustand               # Lightweight global state management
jwt-decode            # Client-side JWT parsing
vite                      # Frontend build tool
@vitejs/plugin-react       # React plugin for Vite
eslint                    # Code linting and formatting
@eslint/js                 # ESLint configuration for JS
eslint-plugin-react-hooks  # Ensures correct React hook usage
eslint-plugin-react-refresh# Enables hot reloading
globals                   # Common global variables
@types/react               # React type definitions
@types/react-dom           # React DOM type definitions
````

### Backend (Node.js + Express + MongoDB)

```bash
express        # Fast, minimalist web framework for Node.js
mongoose       # ODM for MongoDB
socket.io      # Real-time bidirectional communication
cors           # Cross-Origin Resource Sharing middleware
cookie-parser  # Parse cookies for sessions
dotenv         # Environment variable management
jsonwebtoken   # JWT authentication and authorization
bcrypt         # Password hashing
validator      # Input validation and sanitization
nodemon        # Automatically restarts server on file changes
```

## License & Attribution

This project is licensed under the Creative Commons
Attribution 4.0 International (CC BY 4.0).
You are free to:

- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material for any purpose, even commercially

Under the following terms:

- **Attribution** — You must give appropriate credit, provide a link to this repository, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.

For full license details, see:
[https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/)

```

```
