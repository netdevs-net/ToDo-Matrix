# Eisenhower Matrix Todo App

A productivity application based on the Eisenhower Matrix method for task prioritization.

## Features

- Four quadrants for task organization: Urgent & Important, Important but Not Urgent, Urgent but Not Important, and Not Urgent & Not Important
- Drag and drop functionality for moving tasks between quadrants
- Task editing, completion, and deletion
- Persistent storage using browser's localStorage
- Responsive design for desktop and mobile

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
npm install
```

### Development

To run the app in development mode:

```bash
npm run dev
```

### Production Build

To create a production build:

```bash
npm run build
```

### Running in Production

To serve the production build using the Node.js server:

```bash
npm run build
npm start
```

The app will be available at http://localhost:5531 (or the port specified in your .env file).

## Environment Variables

You can customize the server port by creating a `.env` file based on the `.env.example` template:

```
PORT=5531
```

## Technology Stack

- React
- TypeScript
- Tailwind CSS
- dnd-kit (for drag and drop)
- Express.js (for production server)
- Vite (for development and build)

## License

MIT