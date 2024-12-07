import WebSocket, { WebSocketServer } from "ws";
import readline from "readline";
import { Command } from "commander";

const program = new Command();
let serverInstance = null; // To store the WebSocket server instance

// Function to start the WebSocket server
function startServer() {
  const wss = new WebSocketServer({ port: 8080 });
  serverInstance = wss;
  console.log("WebSocket server started on ws://localhost:8080");

  const connectedClients = [];

  wss.on("connection", function connection(ws) {
    ws.on("error", console.error);

    connectedClients.push(ws);
    console.log(
      "New client connected. Total clients:",
      connectedClients.length
    );

    ws.on("message", function message(data, isBinary) {
      console.log("Received message:", data.toString());
      wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data, { binary: isBinary });
        }
      });
    });

    ws.on("close", () => {
      const index = connectedClients.indexOf(ws);
      if (index !== -1) {
        connectedClients.splice(index, 1);
      }
      console.log("Client disconnected");
    });
  });
}

// Function to connect to the WebSocket server as a client
function connectToServer() {
  let reconnectAttempts = 0; // Track number of reconnect attempts

  function createConnection() {
    const ws = new WebSocket("ws://localhost:8080");

    ws.on("open", () => {
      console.log("Connected to WebSocket server");
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.on("line", (line) => {
        ws.send(line);
      });
    });

    ws.on("message", (data) => {
      console.log("Message from server:", data.toString());
    });

    ws.on("close", () => {
      console.log("Disconnected from server.");
      reconnectAttempts += 1;
      const backoffTime = Math.min(
        1000 * Math.pow(2, reconnectAttempts),
        30000
      ); // Exponential backoff with a cap at 30 seconds
      console.log(
        `Attempting to reconnect in ${
          backoffTime / 1000
        } seconds (attempt ${reconnectAttempts})...`
      );
      setTimeout(createConnection, backoffTime);
    });

    ws.on("error", (err) => {
      console.error("Connection error:", err);
    });
  }
  createConnection();
}

// Function to handle graceful shutdown
function gracefulShutdown() {
  console.log("Shutting down gracefully...");
  if (serverInstance) {
    // Disconnect all clients
    serverInstance.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("Server is shutting down");
        client.close();
      }
    });

    serverInstance.close(() => {
      console.log("WebSocket server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// Attach shutdown handlers
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Define CLI commands using Commander
program
  .name("broadcast-server")
  .description("CLI for WebSocket server and client")
  .version("1.0.0");

program
  .command("start")
  .description("Start the WebSocket server")
  .action(() => {
    console.log("Starting server...");
    startServer();
  });

program
  .command("connect")
  .description("Connect to the WebSocket server as a client")
  .action(() => {
    connectToServer();
  });

program.parse(process.argv);
