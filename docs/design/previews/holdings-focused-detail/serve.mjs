import http from "node:http";
import { readFile } from "node:fs/promises";
const files = new Map([
  ["/", "index.html"],
  ["/style.css", "style.css"],
  ["/app.js", "app.js"],
  [
    "/icons.ttf",
    "../../../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf",
  ],
]);
// The icon font is served from the existing dependency, not a new CDN or package.
const font = new URL(
  "../../../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf",
  import.meta.url,
);
const server = http.createServer(async (req, res) => {
  const name = files.get(new URL(req.url, "http://localhost").pathname);
  if (!name) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  try {
    const body = await readFile(
      name.endsWith(".ttf") ? font : new URL(name, import.meta.url),
    );
    res.writeHead(200, {
      "Content-Type": name.endsWith(".ttf")
        ? "font/ttf"
        : name.endsWith(".css")
          ? "text/css"
          : name.endsWith(".js")
            ? "text/javascript"
            : "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (error) {
    console.error(error.message);
    res.writeHead(500);
    res.end("Preview asset unavailable");
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(4181, "127.0.0.1", () =>
  console.log("CogVest Holdings study: http://127.0.0.1:4181/"),
);
