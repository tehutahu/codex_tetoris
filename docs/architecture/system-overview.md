# System Overview

This document provides a high-level overview of the codex_tetoris system architecture.

## Architecture Overview

The system consists of three main layers:

1. **Frontend Layer**: React application with Phaser game engine
2. **Backend Layer**: Node.js server with Express and Socket.IO
3. **Communication Layer**: WebSocket-based real-time communication

## System Architecture Diagram

```mermaid
graph TD
    A[Client Browser] --> B[React App]
    B --> C[Phaser Game Engine]
    C --> D[TetrisScene]
    
    B --> E[Socket.IO Client]
    E --> F[WebSocket Connection]
    F --> G[Node.js Server]
    G --> H[Express Server]
    G --> I[Socket.IO Server]
    
    I --> J[Game State Broadcasting]
    J --> K[Other Players]
    
    H --> L[Static File Serving]
    L --> M[Built React App]
    
    subgraph "Frontend (Port 3000)"
        B
        C
        D
        E
    end
    
    subgraph "Backend (Port 3000)"
        G
        H
        I
        J
    end
    
    subgraph "Game Logic"
        D
        N[Piece Movement]
        O[Collision Detection]
        P[Line Clearing]
        Q[Score Management]
        
        D --> N
        D --> O
        D --> P
        D --> Q
    end
    
    subgraph "Dependencies"
        R[react: ^18.2.0]
        S[phaser: ^3.70.0]
        T[socket.io-client: ^4.7.2]
        U[express: ^4.18.2]
        V[socket.io: ^4.7.2]
    end
```

## Key Components

### Frontend Components
- **React App**: Main application framework
- **Phaser Game Engine**: Handles game rendering and physics
- **Socket.IO Client**: Manages real-time communication

### Backend Components
- **Express Server**: Serves static files and handles HTTP requests
- **Socket.IO Server**: Manages WebSocket connections and broadcasts game state
- **Game State Broadcasting**: Synchronizes game state between players

### Dependencies
- **React**: Frontend framework for UI components
- **Phaser**: 2D game engine for rendering and game logic
- **Socket.IO**: Real-time bidirectional communication
- **Express**: Web server framework 