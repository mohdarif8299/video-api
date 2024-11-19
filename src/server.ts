import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import videoRoutes from "./routes/videoRoutes";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "../swagger.json";

const app = express();

app.use(bodyParser.json());

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/videos", videoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
console.log(`API Documentation available at http://localhost:${PORT}/api/docs`);
