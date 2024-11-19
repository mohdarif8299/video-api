# Video Processing API

## Prerequisites
- **Node.js**: Version 16.16.0 or higher
- **TypeScript**: Version 5.6.3
- **FFmpeg**: Must be installed and accessible in system PATH
- **Database**: SQLite (configured in the project)

## Tech Stack
- Node.js
- Express.js
- TypeScript
- SQLite
- FFmpeg
- Jest (for testing)

## Installation

### Clone the Repository
```bash
git clone <repository-url>
cd video-api
```

### Install Dependencies
```bash
npm install
```

## Running the Application

### Development Mode
```bash
npm run dev
```
- Server runs at `http://localhost:3000`

## Testing
```bash
npm test # Run all tests
```

## API Documentation
Swagger/OpenAPI documentation available at:
- `http://localhost:3000/api/docs`

## API Authorization and Adding Bearer Token in Swagger UI
1. Click the "Authorize" button (lock icon) in Swagger
2. Enter the token in the format: `Bearer token1`

## Architecture
Follows Model-View-Controller (MVC) pattern:
- **Models**: Define data structures for videos, shareable links (in `src/types/`)
- **Controllers**: Handle HTTP request routing and interaction (in `src/controllers/videoControllers.ts`)
- **Services**: Contain business logic and data processing (in `src/services/videoService.ts`)

## References Used

1. **Video Rendering with Node.js and FFmpeg**
   https://creatomate.com/blog/video-rendering-with-nodejs-and-ffmpeg

2. **Design Patterns in TypeScript and Node.js**
   https://blog.logrocket.com/understanding-design-patterns-typescript-node-js/
  

3. **SQLite with Node.js**
   https://www.linode.com/docs/guides/getting-started-with-nodejs-sqlite/

