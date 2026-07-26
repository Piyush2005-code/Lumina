import app from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
    console.log(`🚀 Lumina Backend listening on port ${env.PORT}`);
});