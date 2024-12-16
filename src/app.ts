import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes";
import orderRoutes from "./routes/orderRoutes";
import Order from "./models/Order";
import { getTokenData } from "../bot/web3";
import { apiSwap } from "../bot/swap";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


// Middleware
app.use(express.json());

// MongoDB Connection
mongoose
    .connect(`mongodb+srv://yoshiroito0630:chBbUzT8PuxznEIq@cluster-travelai.mjnhe9t.mongodb.net/MTBBot`)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api", userRoutes);
app.use("/api", orderRoutes);

const monitorOrders = async () => {
    const orders = await Order.find();
    orders.forEach(async (order) => {
        // bot.telegram.sendMessage(order.userId, "Hello user!");
        const tokenData = await getTokenData(order.tokenAddress);
        if (
            tokenData.market_cap_usd <= order.marketCapToHit * 1.02 &&
            tokenData.market_cap_usd >= order.marketCapToHit * 0.98
        ) {
            if (order.mode == "buy") {
                await apiSwap(order.tokenAddress, order.limitAmount, order.privKey, order.userId, true);
            } else {
                await apiSwap(order.tokenAddress, order.limitAmount, order.privKey, order.userId, false);
            }
        }
    });
};

setInterval(monitorOrders, 5000);

// Start Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});